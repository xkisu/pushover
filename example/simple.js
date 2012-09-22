var pushover = require('../');
var repos = pushover('/tmp/repos');

repos.on('push', function (push) {
    console.log(
        'received a push to ' + push.repo + '/' + push.commit
        + ' (' + push.branch + ')'
    );
    push.accept();
});

var http = require('http');
var server = http.createServer(function (req, res) {
    repos.handle(req, res);
});
server.listen(7005);
