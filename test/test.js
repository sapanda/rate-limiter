var rewire = require('rewire');
var expect = require('chai').expect;
var supertest = require('supertest');
var checkRateLimits = rewire('../app/limitCheck');
var request = supertest(checkRateLimits);

// - Test exceeding the limit
// - Test staying just below the limit over time

describe('Exceeding Single Rate Limit', function () {

  var LIMIT = 5;
  var DATA_SOURCE = 'DataSourceA';
  var USER = 'UserA';

  function initializeData() {
    checkRateLimits.__get__('redisClient').FLUSHALL();
    checkRateLimits.__set__('getCurrentDate', function() {
      return new Date('February 3, 2015 11:01:00');
    })
    checkRateLimits.__set__('rateLimitMap', {
      'DataSourceA' : {
        'UserHourly'   : 150,
        'UserDaily'    : 2000,
        'GlobalHourly' : 100000,
        'GlobalDaily'  : 1000000
      }
    });
  };

  function makeQuery(requestData, count, multipleUsers, callback) {
    if (multipleUsers) {
      requestData['user'] = 'User' + count;
    }
    checkRateLimits(requestData, function(err, result) {
      count--;
      if (count >= 0) {
        expect(result).to.equal(true);
        makeQuery(requestData, count, multipleUsers, callback);
      } else {
        expect(result).to.equal(false);
        callback();
      }
    });
  };

  function runTest(limitType, multipleUsers, callback) {
    initializeData();

    checkRateLimits.__get__('rateLimitMap')[DATA_SOURCE][limitType] = LIMIT;
    var requestData = {'datasource' : DATA_SOURCE, 'user' : USER};

    makeQuery(requestData, LIMIT, multipleUsers, callback);
  }

  it('makes 1 query over the UserHourly Limit', function(done) {
    runTest('UserHourly', false, done);
  });

  it('makes 1 query over the UserDaily Limit', function(done) {
    runTest('UserDaily', false, done);
  });

  it('makes 1 query over the GlobalHourly Limit with single user', function(done) {
    runTest('GlobalHourly', false, done);
  });

  it('makes 1 query over the GlobalDaily Limit with single user', function(done) {
    runTest('GlobalDaily', false, done);
  });

  it('makes 1 query over the GlobalHourly Limit with multiple users', function(done) {
    runTest('GlobalHourly', true, done);
  });

  it('makes 1 query over the GlobalDaily Limit with multiple users', function(done) {
    runTest('GlobalDaily', true, done);
  });
});

describe('Staying just under Rate Limit', function () {

  var LIMIT = 10;
  var DATA_SOURCE = 'DataSourceA';
  var USER = 'UserA';

  var HALF_AN_HOUR = 30 * 60 * 1000;
  var HALF_A_DAY = HALF_AN_HOUR * 24;

  function initializeData() {
    checkRateLimits.__get__('redisClient').FLUSHALL();
    checkRateLimits.__set__('getCurrentDate', function() {
      return new Date('February 3, 2015 11:01:00');
    })
    checkRateLimits.__set__('rateLimitMap', {
      'DataSourceA' : {
        'UserHourly'   : 150,
        'UserDaily'    : 2000,
        'GlobalHourly' : 100000,
        'GlobalDaily'  : 1000000
      }
    });
  };

  function addMillisecondsToCurrentDate(millis) {
    var currentDate = checkRateLimits.__get__('getCurrentDate')();

    checkRateLimits.__set__('getCurrentDate', function() {
      currentDate.setMilliseconds(currentDate.getMilliseconds() + millis);
      return currentDate;
    });
  };

  function makeQuery(requestData, count, callback) {
    checkRateLimits(requestData, function(err, result) {
      count--;
      if (count >= 0) {
        expect(result).to.equal(true);
        makeQuery(requestData, count, callback);
      } else {
        callback();
      }
    });
  };

  function makeQueryAtIntervals(requestData, interval, numTimes, callback) {
    if (numTimes > 0) {
      addMillisecondsToCurrentDate(interval);
      makeQuery(requestData, LIMIT / 2, function() {
        makeQueryAtIntervals(requestData, interval, numTimes - 1, callback)
      });
    } else {
      callback();
    }
  }

  function runTest(limitType, interval, callback) {
    initializeData();

    checkRateLimits.__get__('rateLimitMap')[DATA_SOURCE][limitType] = LIMIT;
    var requestData = {'datasource' : DATA_SOURCE, 'user' : USER};

    makeQueryAtIntervals(requestData, interval, 3, callback);
  }

  it('makes (Limit / 2) queries every 30 minutes to stay just under the UserHourly Limit', function(done) {
    runTest('UserHourly', HALF_AN_HOUR, done);
  });

  it('makes (Limit / 2) queries every 12 hours to stay just under the UserDaily Limit', function(done) {
    runTest('UserDaily', HALF_A_DAY, done);
  });

  it('makes (Limit / 2) queries every 30 minutes to stay just under the GlobalHourly Limit', function(done) {
    runTest('GlobalHourly', HALF_AN_HOUR, done);
  });

  it('makes (Limit / 2) queries every 12 hours to stay just under the GlobalDaily Limit', function(done) {
    runTest('GlobalDaily', HALF_A_DAY, done);
  });
});