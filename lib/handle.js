var url = require('url');
var qs = require('qs');
var path = require('path');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

var services = [ 'upload-pack', 'receive-pack' ]
var createAction = require('./service');
var onexit = require('./onexit');

module.exports = function (req, res) {
    var self = this;
    (function next (ix) {
        var x = handlers[ix].call(self, req, res);
        if (x === false) next(ix + 1);
    })(0);
};

var handlers = [];
handlers.push(function (req, res) {
    if (req.method !== 'GET') return false;
    
    var u = url.parse(req.url);
    var m = u.pathname.match(/\/([^\/]+)\/info\/refs$/);
    if (!m) return false;
    
    var self = this;
    
    var repo = m[1];
    var repopath = self.checkout
        ? path.join(self.repoDir, repo, '.git')
        : path.join(self.repoDir, repo)
    ;
    
    var params = qs.parse(u.query);
    if (!params.service) {
        res.statusCode = 400;
        res.end('service parameter required');
        return;
    }
    
    var service = params.service.replace(/^git-/, '');
    if (services.indexOf(service) < 0) {
        res.statusCode = 405;
        res.end('service not available');
        return;
    }
    
    var next = function () {
        res.setHeader('content-type',
            'application/x-git-' + service + '-advertisement'
        );
        noCache(res);
        serviceRespond(service, repopath, res);
    };
    
    self.exists(repo, function (ex) {
        if (!ex && self.autoCreate) self.create(repo, next)
        else if (!ex) {
            res.statusCode = 404;
            res.setHeader('content-type', 'text/plain');
            res.end('repository not found');
        }
        else next()
    });
});

handlers.push(function (req, res) {
    if (req.method !== 'GET') return false;
    var m = u.pathname.match(/^\/([^\/]+)\/HEAD$/);
    if (!m) return false;
    
    var self = this;
    
    var repo = m[1];
    var repopath = self.checkout
        ? path.join(self.repoDir, repo, '.git')
        : path.join(self.repoDir, repo)
    ;
    
    var next = function () {
        var file = path.join(repopath, 'HEAD');
        (fs.exists || path.exists)(file, function (ex) {
            if (ex) fs.createReadStream(file).pipe(res)
            else {
                res.statusCode = 404;
                res.end('not found');
            }
        });
    }
    
    self.exists(repo, function (ex) {
        if (!ex && self.autoCreate) self.create(repo, next)
        else if (!ex) {
            res.statusCode = 404;
            res.setHeader('content-type', 'text/plain');
            res.end('repository not found');
        }
        else next()
    });
});

handlers.push(function (req, res) {
    if (req.method !== 'POST') return false;
    var m = req.url.match(/\/([^\/]+)\/git-(.+)/);
    if (!m) return false;
    
    var self = this;
    var repo = m[1], service = m[2];
    
    if (services.indexOf(service) < 0) {
        res.statusCode = 405;
        res.end('service not available');
        return;
    }
    
    res.setHeader('content-type', 'application/x-git-' + service + '-result');
    noCache(res);
    
    var action = createAction({
        service : service,
        cwd : path.join(self.repoDir, repo)
    }, req, res);
    
    action.on('info', function () {
        self.emit('push', action);
    });
});

handlers.push(function (req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.statusCode = 405;
        res.end('method not supported');
    }
    else return false;
});

handlers.push(function (req, res) {
    res.statusCode = 404;
    res.end('not found');
});

function noCache (res) {
    res.setHeader('expires', 'Fri, 01 Jan 1980 00:00:00 GMT');
    res.setHeader('pragma', 'no-cache');
    res.setHeader('cache-control', 'no-cache, max-age=0, must-revalidate');
}

function serviceRespond (service, file, res) {
    function pack (s) {
        var n = (4 + s.length).toString(16);
        return Array(4 - n.length + 1).join('0') + n + s;
    }
    res.write(pack('# service=git-' + service + '\n'));
    res.write('0000');
    
    var ps = spawn('git-' + service, [
        '--stateless-rpc',
        '--advertise-refs',
        file
    ]);
    ps.stdout.pipe(res, { end : false });
    ps.stderr.pipe(res, { end : false });
    
    onexit(ps, function () { res.end() });
}
