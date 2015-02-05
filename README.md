# Rate Limiting System

A simple implementation of a rate limiting system. The system uses Redis to keep track of request counts for each Data Source for 4 limit types: Per User Per Hour, Per User Per Day, Global Per Hour, Global Per Day. The actual limits for each Data Source are stored in the limits.json file.

## Using the System

Before running the application, you will need to run a Redis server:

[Download and Build Redis](http://redis.io/download)  
`> src/redis-server`

Option 1: Run as a server

`> npm start`  
`> curl 'http://localhost:8080/?datasource=DataSourceA&user=UserA'`  

Option 2: Run as a module

`var checkRateLimits = require('./app/limitCheck');`  
`checkRateLimits({'datasource': 'DataSourceA', 'user': 'UserA'}, callback);`  

## Testing

Run all test cases using the following command:

`> npm test`

## Improvements

The current system is able to limit rates on a strictly per-hour or per-day basis. This means that if an API has a limit of 10 calls per hour, and all 10 calls occur in the last minute of the hour, 10 additional calls can still be performed in the first minute of the following hour. Certain external APIs might not like this and might require a rolling window instead. One potential solution (that might have performance implications) is to record request counts on a per-minute basis and then sum the counts across the previous 60 minutes when deciding whether the limit has been exceeded.