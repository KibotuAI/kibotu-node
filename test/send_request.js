let Kibotu;
const Sinon = require('sinon');
const proxyquire = require('proxyquire');
const https = require('https');
const events = require('events');
const httpProxyOrig  = process.env.HTTP_PROXY;
const httpsProxyOrig = process.env.HTTPS_PROXY;
let HttpsProxyAgent;

exports.send_request = {
    setUp: function(next) {
        HttpsProxyAgent = Sinon.stub();
        Kibotu = proxyquire('../lib/kibotu-node', {
            'https-proxy-agent': HttpsProxyAgent,
        });

        Sinon.stub(https, 'request');

        this.http_emitter = new events.EventEmitter;
        this.http_end_spy = Sinon.spy();
        this.http_write_spy = Sinon.spy();
        this.http_emitter.write = this.http_write_spy;
        this.http_emitter.end = this.http_end_spy;
        this.res = new events.EventEmitter;
        https.request.returns(this.http_emitter);
        https.request.callsArgWith(1, this.res);

        this.kibotu = Kibotu.init('token');

        next();
    },

    tearDown: function(next) {
        https.request.restore();

        // restore proxy variables
        process.env.HTTP_PROXY = httpProxyOrig;
        process.env.HTTPS_PROXY = httpsProxyOrig;

        next();
    },

    "sends correct data on GET": function(test) {
        var endpoint = "/track",
            data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 1346876621
                }
            },
            expected_http_request = {
                
                host: 'api.kibotu.ai',
                headers: {},
                path: '/track?ip=0&verbose=0&data=eyJldmVudCI6InRlc3QiLCJwcm9wZXJ0aWVzIjp7ImtleTEiOiJ2YWwxIiwidG9rZW4iOiJ0b2tlbiIsInRpbWUiOjEzNDY4NzY2MjF9fQ%3D%3D'
            };

        this.kibotu.send_request({  endpoint: endpoint, data: data });

        test.expect(3);
        test.ok(https.request.calledWithMatch(expected_http_request), "send_request didn't call https.request with correct arguments");
        test.ok(this.http_end_spy.callCount === 1, "send_request didn't end https.request");
        test.ok(this.http_write_spy.callCount === 0, "send_request called write for a GET");

        test.done();
    },

    "defaults to GET": function(test) {
        var endpoint = "/track",
            data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 1346876621
                }
            },
            expected_http_request = {
                
                host: 'api.kibotu.ai',
                headers: {},
                path: '/track?ip=0&verbose=0&data=eyJldmVudCI6InRlc3QiLCJwcm9wZXJ0aWVzIjp7ImtleTEiOiJ2YWwxIiwidG9rZW4iOiJ0b2tlbiIsInRpbWUiOjEzNDY4NzY2MjF9fQ%3D%3D'
            };

        this.kibotu.send_request({ endpoint: endpoint, data: data }); // method option not defined

        test.ok(https.request.calledWithMatch(expected_http_request), "send_request didn't call https.request with correct method argument");

        test.done();
    },

    "sends correct data on POST": function(test) {
        var endpoint = "/track",
            data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 1346876621
                }
            },
            expected_http_request = {
                method: 'POST',
                host: 'api.kibotu.ai',
                headers: {},
                path: '/track?ip=0&verbose=0'
            },
            expected_http_request_body = "data=eyJldmVudCI6InRlc3QiLCJwcm9wZXJ0aWVzIjp7ImtleTEiOiJ2YWwxIiwidG9rZW4iOiJ0b2tlbiIsInRpbWUiOjEzNDY4NzY2MjF9fQ==";

        this.kibotu.send_request({ method: 'post', endpoint: endpoint, data: data });

        test.expect(3);
        test.ok(https.request.calledWithMatch(expected_http_request), "send_request didn't call https.request with correct arguments");
        test.ok(this.http_end_spy.callCount === 1, "send_request didn't end https.request");
        test.ok(this.http_write_spy.calledWithExactly(expected_http_request_body), "send_request did not write data correctly for a POST");

        test.done();
    },

    "sets ip=1 when geolocate option is on": function(test) {
      this.kibotu.set_config({ geolocate: true });

      this.kibotu.send_request({ endpoint: "/track", event: "test", data: {} });

      test.ok(https.request.calledWithMatch({ path: Sinon.match('ip=1') }), "send_request didn't call http.get with correct request data");

      test.done();
    },

    "handles kibotu errors": function(test) {
        test.expect(1);
        this.kibotu.send_request({ endpoint: "/track", data: { event: "test" } }, function(e) {
            test.equal(e.message, 'Kibotu Server Error: 0', "error did not get passed back to callback");
            test.done();
        });

        this.res.emit('data', '0');
        this.res.emit('end');
    },

    "handles https.request errors": function(test) {
        test.expect(1);
        this.kibotu.send_request({ endpoint: "/track", data: { event: "test" } }, function(e) {
            test.equal(e, 'error', "error did not get passed back to callback");
            test.done();
        });

        this.http_emitter.emit('error', 'error');
    },

    "default use keepAlive agent": function(test) {
        test.expect(2);
        var agent = new https.Agent({ keepAlive: false });
        var httpsStub = {
            request: Sinon.stub().returns(this.http_emitter).callsArgWith(1, this.res),
            Agent: Sinon.stub().returns(agent),
        };
        // force SDK not use `undefined` string to initialize proxy-agent
        delete process.env.HTTP_PROXY
        delete process.env.HTTPS_PROXY
        Kibotu = proxyquire('../lib/kibotu-node', {
            'https': httpsStub
        });
        var proxyKibotu = Kibotu.init('token');
        proxyKibotu.send_request({ endpoint: '', data: {} });

        var getConfig = httpsStub.request.firstCall.args[0];
        var agentOpts = httpsStub.Agent.firstCall.args[0];
        test.ok(agentOpts.keepAlive === true, "HTTP Agent wasn't initialized with keepAlive by default");
        test.ok(getConfig.agent === agent, "send_request didn't call https.request with agent");

        test.done();
    },

    "uses correct hostname": function(test) {
        var host = 'testhost.fakedomain';
        var customHostnameKibotu = Kibotu.init('token', { host: host });
        var expected_http_request = {
            host: host
        };

        customHostnameKibotu.send_request({ endpoint: "", data: {} });

        test.ok(https.request.calledWithMatch(expected_http_request), "send_request didn't call https.request with correct hostname");

        test.done();
    },

    "uses correct port": function(test) {
        var host = 'testhost.fakedomain:1337';
        var customHostnameKibotu = Kibotu.init('token', { host: host });
        var expected_http_request = {
            host: 'testhost.fakedomain',
            port: 1337
        };

        customHostnameKibotu.send_request({ endpoint: "", data: {} });

        test.ok(https.request.calledWithMatch(expected_http_request), "send_request didn't call https.request with correct hostname and port");

        test.done();
    },

    "uses correct path": function(test) {
        var host = 'testhost.fakedomain';
        var customPath = '/mypath';
        var customHostnameKibotu = Kibotu.init('token', {
            host,
            path: customPath,
        });
        var expected_http_request = {
            host,
            path: '/mypath?ip=0&verbose=0&data=e30%3D',
        };

        customHostnameKibotu.send_request({endpoint: "", data: {}});
        test.ok(https.request.calledWithMatch(expected_http_request), "send_request didn't call https.request with correct hostname and port");

        test.done();
    },

    "combines custom path and endpoint": function(test) {
        var host = 'testhost.fakedomain';
        var customPath = '/mypath';
        var customHostnameKibotu = Kibotu.init('token', {
            host,
            path: customPath,
        });
        var expected_http_request = {
            host,
            path: '/mypath/track?ip=0&verbose=0&data=e30%3D',
        };

        customHostnameKibotu.send_request({endpoint: '/track', data: {}});
        test.ok(https.request.calledWithMatch(expected_http_request), "send_request didn't call https.request with correct hostname and port");

        test.done();
    },

    "uses HTTP_PROXY if set": function(test) {
        HttpsProxyAgent.reset(); // Kibotu is instantiated in setup, need to reset callcount
        delete process.env.HTTPS_PROXY;
        process.env.HTTP_PROXY = 'this.aint.real.https';

        var proxyKibotu = Kibotu.init('token');
        proxyKibotu.send_request({ endpoint: '', data: {} });

        test.ok(HttpsProxyAgent.calledOnce, "HttpsProxyAgent was not called when process.env.HTTP_PROXY was set");

        var agentOpts = HttpsProxyAgent.firstCall.args[0];
        test.ok(agentOpts.pathname === "this.aint.real.https", "HttpsProxyAgent was not called with the correct proxy path");
        test.ok(agentOpts.keepAlive === true, "HttpsProxyAgent was not called with the correct proxy path");

        var getConfig = https.request.firstCall.args[0];
        test.ok(getConfig.agent !== undefined, "send_request didn't call https.request with agent");

        test.done();
    },

    "uses HTTPS_PROXY if set": function(test) {
        HttpsProxyAgent.reset(); // Kibotu is instantiated in setup, need to reset callcount
        delete process.env.HTTP_PROXY;
        process.env.HTTPS_PROXY = 'this.aint.real.https';

        var proxyKibotu = Kibotu.init('token');
        proxyKibotu.send_request({ endpoint: '', data: {} });

        test.ok(HttpsProxyAgent.calledOnce, "HttpsProxyAgent was not called when process.env.HTTPS_PROXY was set");

        var proxyOpts = HttpsProxyAgent.firstCall.args[0];
        test.ok(proxyOpts.pathname === 'this.aint.real.https', "HttpsProxyAgent was not called with the correct proxy path");

        var getConfig = https.request.firstCall.args[0];
        test.ok(getConfig.agent !== undefined, "send_request didn't call https.request with agent");

        test.done();
    },

    "requires credentials for import requests": function(test) {
        test.throws(
            this.kibotu.send_request.bind(this, {
                endpoint: `/import`,
                data: {event: `test event`},
            }),
            /The Kibotu Client needs a Kibotu API Secret when importing old events/,
            "import request didn't throw error when no credentials provided"
        );
        test.done();
    },

    "sets basic auth header if API secret is provided": function(test) {
        this.kibotu.set_config({secret: `foobar`});
        this.kibotu.send_request({
            endpoint: `/import`,
            data: {event: `test event`},
        });
        test.ok(https.request.calledOnce);
        test.deepEqual(https.request.args[0][0].headers, {
            'Authorization': `Basic Zm9vYmFyOg==`, // base64 of "foobar:"
        }, "send_request didn't pass correct auth header to https.request");
        test.done();
    },

    "still supports import with api_key (legacy)": function(test) {
        this.kibotu.set_config({key: `barbaz`});
        this.kibotu.send_request({
            endpoint: `/import`,
            data: {},
        });
        test.ok(https.request.calledOnce);
        test.equal(
            https.request.args[0][0].path,
            `/import?ip=0&verbose=0&data=e30%3D&api_key=barbaz`,
            "send_request didn't pass correct query params to https.request"
        );
        test.done();
    },
};
