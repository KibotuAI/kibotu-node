// grab the Kibotu factory
var Kibotu = require('./lib/kibotu-node');

// create an instance of the kibotu client
var kibotu = Kibotu.init('962dbca1bbc54701d402c94d65b4a20e');
kibotu.set_config({ debug: true });

// track an event with optional properties
kibotu.track("my event", {
    distinct_id: "some unique client id",
    as: "many",
    properties: "as",
    you: "want"
});
kibotu.track("played_game");

// create or update a user in Kibotu Engage
kibotu.people.set("billybob", {
    $first_name: "Billy",
    $last_name: "Bob",
    $created: (new Date('jan 1 2013')).toISOString(),
    plan: "premium",
    games_played: 1,
    points: 0
});

// create or update a user in Kibotu Engage without altering $last_seen
// - pass option `$ignore_time: true` to prevent the $last_seen property from being updated
kibotu.people.set("billybob", {
    plan: "premium",
    games_played: 1
}, {
    $ignore_time: true
});

// set a single property on a user
kibotu.people.set("billybob", "plan", "free");

// set a single property on a user, don't override
kibotu.people.set_once("billybob", "first_game_play", (new Date('jan 1 2013')).toISOString());

// increment a numeric property
kibotu.people.increment("billybob", "games_played");

// increment a numeric property by a different amount
kibotu.people.increment("billybob", "points", 15);

// increment multiple properties
kibotu.people.increment("billybob", {"points": 10, "games_played": 1});

// append value to a list
kibotu.people.append("billybob", "awards", "Great Player");

// append multiple values to a list
kibotu.people.append("billybob", {"awards": "Great Player", "levels_finished": "Level 4"});

// record a transaction for revenue analytics
kibotu.people.track_charge("billybob", 39.99);

// clear a users transaction history
kibotu.people.clear_charges("billybob");

// delete a user
kibotu.people.delete_user("billybob");

// all functions that send data to kibotu take an optional
// callback as the last argument
kibotu.track("test", function(err) { if (err) { throw err; } });

// import an old event
var kibotu_importer = Kibotu.init('valid kibotu token', {
    secret: "valid api secret for project"
});
kibotu_importer.set_config({ debug: true });

// needs to be in the system once for it to show up in the interface
kibotu_importer.track('old event', { gender: '' });

kibotu_importer.import("old event", new Date(2012, 4, 20, 12, 34, 56), {
    distinct_id: 'billybob',
    gender: 'male'
});

// import multiple events at once
kibotu_importer.import_batch([
    {
        event: 'old event',
        properties: {
            time: new Date(2012, 4, 20, 12, 34, 56),
            distinct_id: 'billybob',
            gender: 'male'
        }
    },
    {
        event: 'another old event',
        properties: {
            time: new Date(2012, 4, 21, 11, 33, 55),
            distinct_id: 'billybob',
            color: 'red'
        }
    }
]);
