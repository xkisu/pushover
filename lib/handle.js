var url = require('url');
var qs = require('qs');
var path = require('path');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

var services = [ 'upload-pack', 'receive-pack' ]

var createAction = require('./service');
var onexit = require('./onexit');
var noCache = require('./no_cache');

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
    
    infoResponse({
        repos : self,
        repo : repo,
        service : service,
    }, req, res);
});

handlers.push(function (req, res) {
    if (req.method !== 'GET') return false;
    var m = u.pathname.match(/^\/([^\/]+)\/HEAD$/);
    if (!m) return false;
    
    var self = this;
    var repo = m[1];
    
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
        repo : repo,
        service : service,
        cwd : path.join(self.repoDir, repo)
    }, req, res);
    
    var evName = {
        'upload-pack' : 'fetch',
        'receive-pack' : 'push',
    }[service];
    
    action.on('header', function () {
        var anyListeners = self.listeners(evName).length > 0;
        self.emit(evName, action);
        if (!anyListeners) action.accept();
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

var httpDuplex = require('http-duplex');

function infoResponse (opts, req, res) {
    var self = opts.repos;
    var dup = httpDuplex(req, res);
    
    dup.accept = function () { dup.emit('accept') };
    dup.reject = function (code) { dup.emit('reject', code) };
    
    dup.once('reject', function (code) {
        res.statusCode = code || 500;
        res.end();
    });
    
    self.exists(opts.repo, function (ex) {
        var anyListeners = self.listeners('info').length > 0;
        
        if (!ex && self.autoCreate) {
            dup.exists = ex;
            
            dup.on('accept', function () {
                self.create(opts.repo, next)
            });
            
            self.emit('info', dup);
            if (!anyListeners) dup.accept();
        }
        else if (!ex) {
            res.statusCode = 404;
            res.setHeader('content-type', 'text/plain');
            res.end('repository not found');
        }
        else {
            dup.on('accept', next);
            self.emit('info', dup);
            
            if (!anyListeners) dup.accept();
        }
    });
    
    function next () {
        res.setHeader('content-type',
            'application/x-git-' + opts.service + '-advertisement'
        );
        noCache(res);
        serviceRespond(opts.service, path.join(self.repoDir, opts.repo), res);
    }
}
