var httpDuplex = require('http-duplex');

module.exports = function (opts, req, res) {
    var push = httpDuplex(req, res);
    Object.keys(opts).forEach(function (key) {
        push[key] = opts[key];
    });
    
    push.accept = function (msg) {
        push.statusCode = 200;
        if (msg) push.write(msg);
        push.end();
    };
    
    push.reject = function (code, msg) {
        if (msg === undefined && typeof code === 'string') {
            msg = code;
            code = 500;
        }
        push.statusCode = code || 500;
        if (msg) push.write(msg);
        push.end();
    };
    
    return push;
};
