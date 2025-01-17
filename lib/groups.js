/**
 * Group profile methods. Learn more: https://help.kibotu.ai/hc/en-us/articles/360025333632
 */

const {ProfileHelpers} = require('./profile_helpers');

class KibotuGroups extends ProfileHelpers() {
    constructor(mp_instance) {
        super();
        this.kibotu = mp_instance;
        this.endpoint = '/groups';
    }

    /** groups.set_once(group_key, group_id, prop, to, modifiers, callback)
        ---
        The same as groups.set, but adds a property value to a group only if it has not been set before.
    */
    set_once(group_key, group_id, prop, to, modifiers, callback) {
        const identifiers = {$group_key: group_key, $group_id: group_id};
        this._set(prop, to, modifiers, callback, {identifiers, set_once: true});
    }

    /**
        groups.set(group_key, group_id, prop, to, modifiers, callback)
        ---
        set properties on a group profile

        usage:

            kibotu.groups.set('company', 'Acme Inc.', '$name', 'Acme Inc.');

            kibotu.groups.set('company', 'Acme Inc.', {
                'Industry': 'widgets',
                '$name': 'Acme Inc.',
            });
    */
    set(group_key, group_id, prop, to, modifiers, callback) {
        const identifiers = {$group_key: group_key, $group_id: group_id};
        this._set(prop, to, modifiers, callback, {identifiers});
    }

    /**
     groups.delete_group(group_key, group_id, modifiers, callback)
        ---
        delete a group profile permanently

        usage:

        kibotu.groups.delete_group('company', 'Acme Inc.');
        */
    delete_group(group_key, group_id, modifiers, callback) {
        const identifiers = {$group_key: group_key, $group_id: group_id};
        this._delete_profile({identifiers, modifiers, callback});
    }

    /**
     groups.remove(group_key, group_id, data, modifiers, callback)
        ---
        remove a value from a list-valued group profile property.

        usage:

        kibotu.groups.remove('company', 'Acme Inc.', {'products': 'anvil'});

        kibotu.groups.remove('company', 'Acme Inc.', {
            'products': 'anvil',
            'customer segments': 'coyotes'
        });
        */
    remove(group_key, group_id, data, modifiers, callback) {
        const identifiers = {$group_key: group_key, $group_id: group_id};
        this._remove({identifiers, data, modifiers, callback});
    }

    /**
     groups.union(group_key, group_id, data, modifiers, callback)
        ---
        merge value(s) into a list-valued group profile property.

        usage:

        kibotu.groups.union('company', 'Acme Inc.', {'products': 'anvil'});

        kibotu.groups.union('company', 'Acme Inc.', {'products': ['anvil'], 'customer segments': ['coyotes']});
        */
    union(group_key, group_id, data, modifiers, callback) {
        const identifiers = {$group_key: group_key, $group_id: group_id};
        this._union({identifiers, data, modifiers, callback})
    }

    /**
     groups.unset(group_key, group_id, prop, modifiers, callback)
        ---
        delete a property on a group profile

        usage:

        kibotu.groups.unset('company', 'Acme Inc.', 'products');

        kibotu.groups.unset('company', 'Acme Inc.', ['products', 'customer segments']);
        */
    unset(group_key, group_id, prop, modifiers, callback) {
        const identifiers = {$group_key: group_key, $group_id: group_id};
        this._unset({identifiers, prop, modifiers, callback})
    }
}

exports.KibotuGroups = KibotuGroups;
