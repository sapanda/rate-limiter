var redis = require('redis');
var redisClient = redis.createClient();
var rateLimitMap = require('./limitLoader')();

redisClient.on('error', function (err) {
  console.log('Error ' + err);
});

var TWO_HOURS = 2 * 60 * 60;
var TWO_DAYS = TWO_HOURS * 24;

// Note: Separate function makes dependency injection for testing easier
function getCurrentDate() {
  return new Date();
}

// Generate the prefix of the key that will be supplied to Redis
function generateKeyPrefix(dataSourceId, userId) {
  var prefix = 'Source:' + dataSourceId + ':';

  if (userId) {
    prefix += 'User:' + userId + ':';
  }

  return prefix;
}

// Check to see if the call would exceed the specified limitType
function checkAgainstSpecificRateLimit(
  key, limitType, rateLimits, expireTime, transaction, callback) {

  if (limitType in rateLimits) {
    redisClient.get(key, function(err, reply) {
      if (err) {
        console.log(err)
        callback(err);
      } else if (reply && reply >= rateLimits[limitType]) {
        var message = 'Exceeded the ' + limitType +
                      ' rate limit of ' + rateLimits[limitType] + '.';
        callback(null, false, message);
      } else {
        transaction
          .incr(key)
          .expire(key, expireTime);
        callback(null, true);
      }
    });
  } else {
    callback(null, true);
  }
}

// Return a queue of rate check jobs for the different rate limit types
function generateRateCheckQueue(dataSourceId, userId, transaction, rateCheckCallback) {

  var date = getCurrentDate();
  var currentHour = date.getHours();
  var currentDay = date.getDate();

  var rateLimits = rateLimitMap[dataSourceId];

  // Enqueue all rate limit checks
  var queue = [];

  // Per User Hourly
  queue.push(function() {
    var key = generateKeyPrefix(dataSourceId, userId) + 'Hour:' + currentHour;
    checkAgainstSpecificRateLimit(key, 'UserHourly', rateLimits, TWO_HOURS,
      transaction, rateCheckCallback);
  });

  // Per User Daily
  queue.push(function() {
    var key = generateKeyPrefix(dataSourceId, userId) + 'Day:' + currentDay;
    checkAgainstSpecificRateLimit(key, 'UserDaily', rateLimits, TWO_DAYS,
      transaction, rateCheckCallback);
  });

  // Global Hourly
  queue.push(function() {
    var key = generateKeyPrefix(dataSourceId) + 'Hour:' + currentHour;
    checkAgainstSpecificRateLimit(key, 'GlobalHourly', rateLimits, TWO_HOURS,
      transaction, rateCheckCallback);
  });

  // Global Daily
  queue.push(function() {
    var key = generateKeyPrefix(dataSourceId) + 'Day:' + currentDay;
    checkAgainstSpecificRateLimit(key, 'GlobalDaily', rateLimits, TWO_DAYS,
      transaction, rateCheckCallback);
  });

  return queue;
}

// Check to see if there are any rate limits that would prevent a call
// to the given dataSource for the given user
function checkRateLimits(dataSourceId, userId, callback) {

  // Create a queue for each of the different limit types and test against them
  // If successful, increment counters for all limit types in one transaction
  var transaction = redisClient.multi();

  var rateCheckCallback = function(err, success, message) {
    if (err) {
      callback(err);
    } else if (!success) {
      callback(err, success, message);
    } else if (queue.length > 0) {
      var nextCheck = queue.shift();
      nextCheck();
    } else {
      transaction.exec(function(err, replies) {
        if (err) {
          console.log(err);
          callback(err);
        } else {
          callback(null, true);
        }
      });
    }
  }

  var queue = generateRateCheckQueue(dataSourceId, userId,
    transaction, rateCheckCallback);

  // Start processing the queue
  rateCheckCallback(null, true);
}

// @requestData: A dictionary containing the datasource Id and
//               user Id for the corresponding request
// @callback: A callback function with 3 arguments:
//            - err: The error message to be returned
//            - success: Boolean representing whether the call
//                       would be within the rate limit
//            - message: Error message if limit is exceeded
//
module.exports = function(requestData, callback) {
  var dataSourceId = requestData['datasource'];
  var userId = requestData['user'];

  if (dataSourceId in rateLimitMap) {
    checkRateLimits(dataSourceId, userId, callback);
  } else {
    callback(null, false, 'Invalid Data Source Id');
  }
};