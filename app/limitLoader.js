var fs = require('fs');

module.exports = function getRateLimitMap() {
    return JSON.parse(fs.readFileSync('config/limits.json'));
}