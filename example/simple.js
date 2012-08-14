var pushover = require('pushover');
var repos = pushover(__dirname + '/repos');

repos.on('push', function (repo, commit) {
    console.log('received a push to ' + repo + '/' + commit);
});

repos.listen(7005);
