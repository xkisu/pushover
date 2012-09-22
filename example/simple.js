var pushover = require('../');
var repos = pushover('/tmp/repos');

repos.on('push', function (push) {
    console.log(
        'received a push to ' + push.repo + '/' + push.commit
        + ' (' + push.branch + ')'
    );
    push.accept();
});

repos.listen(7005);
