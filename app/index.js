var express = require('express');
var app = express();
var checkRateLimits = require('./limitCheck.js');

app.get('/', function (request, response) {

  var callback = function(err, success, message) {
    if (err) {
      response.sendStatus(500);
    } else if (success) {
      response.sendStatus(200);
    } else {
      response.status(290).send(message);
    }
  };

  checkRateLimits(request.query, callback);
})

app.listen(8080);