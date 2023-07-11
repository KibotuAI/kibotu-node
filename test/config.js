var Kibotu = require('../lib/kibotu-node');

exports.config = {
    setUp: function(cb) {
        this.kibotu = Kibotu.init('asjdf');
        cb();
    },

    "is set to correct defaults": function(test) {
        test.deepEqual(this.kibotu.config, {
            test: false,
            debug: false,
            verbose: false,
            host: 'api.kibotu.ai',
            protocol: 'https',
            path: '',
            keepAlive: true,
            geolocate: false,
        }, "default config is incorrect");
        test.done();
    },

    "is modified by set_config": function(test) {
        test.equal(this.kibotu.config.test, false, "default config has incorrect value for test");

        this.kibotu.set_config({ test: true });

        test.equal(this.kibotu.config.test, true, "set_config failed to modify the config");

        test.done();
    },

    "can be set during init": function(test) {
        var mp = Kibotu.init('token', { test: true });

        test.equal(mp.config.test, true, "init() didn't set the config correctly");
        test.done();
    },

    "host config is split into host and port": function(test) {
        const exampleHost = 'api.example.com';
        const examplePort = 70;
        const hostWithoutPortConfig = Kibotu.init('token', {host: exampleHost}).config;
        test.equal(hostWithoutPortConfig.port, undefined, "port should not have been added to config");
        test.equal(hostWithoutPortConfig.host, exampleHost, `host should match ${exampleHost}`);

        const hostWithPortConfig = Kibotu.init('token', {host: `${exampleHost}:${examplePort}`}).config;
        test.equal(hostWithPortConfig.port, examplePort, "port should have been added to config");
        test.equal(hostWithPortConfig.host, exampleHost, `host should match ${exampleHost}`);

        test.done();
    },
};
