# Change Sources

The bulk of the library's functionality is involved in identifying and notifying [ChangeSources](./ARCHITECTURE.md) for various types of Objects.  This boils down to knowing which intercepted Proxy calls imply the existence of a ChangeSource, and which intercepted Proxy calls imply a possible change to be published by one of those ChangeSources.

Note that all of this is "best effort".  It's possible for an application to use functions like defineProperty() to create objects that subvert some of the assumptions made here.  The idea is for these rules to try to work with Objects that behave in typically-expected ways.

For each type of Object, there is a list of potential ChangeSources, and what should happen in response to Proxy traps for the ChangeProxy wrapping that Object:

When "subscribe to ...ChangeSource" is specified, that means:

* see if there is currently a ChangeContext for the ChangeProxy's ChangeDomain.  If so:
    * create the ChangeSource, if not already created
    * add a ChangeListener from the ChangeContext to the ChangeSource

When "notify ...ChangeSource" is specified, that means:

* see if the ChangeSource exists.  If so:
    * send the notification to that ChangeSource

Unless otherwise specified, once it has executed the specified behaviors, the ChangeProxy should pass the call to the proxy's target (the "wrapped" Object).  Before doing so, it should wrap any arguments in ChangeProxies, and wrap any return value in ChangeProxies.

Some Object types also intercept specific function calls, aka "function traps".  Where those are specified, that means that calling get({function name}) needs to return a Proxied wrapper around the underlying function, and the specified behavior should be invoked when that Proxy's apply() method is called.

## Removing Change Sources

Over time, an Object can build up many ChangeSources for various properties and other items.  If those ChangeSources are not removed, they can eventually form a memory leak.

For that reason, each ChangeSource has a remove() function that removes it from an Object.  At the end of each ChangeTransaction, all of the ChangeSources involved in that transaction are checked to see if they are empty, and their remove() functions are called if so.

## Change Source Types

### Object Change Sources

These apply to "generic" Objects, that aren't covered by other cases.

ChangeSources:

* ObjectPrototypeOfChangeSource
* ObjectIsExtensibleChangeSource
* ObjectOwnPropertyDescriptorChangeSource[prop]
* ObjectHasPropertyChangeSource[prop]
* ObjectPropertyChangeSource[prop]
* ObjectOwnKeysChangeSource

Proxy traps:

* get(prop)
    * if the property is defined as a getter with no setter:
        * wrap the getter in a Cached Function (if not already wrapped)
        * subscribe to the Cached Function's ChangeSource
        * evaluate the CachedFunction
    * else
        * subscribe to ObjectPropertyChangeSource[prop]
* has(prop)
    * subscribe to ObjectHasPropertyChangeSource[prop]
* set(prop, value)
    * notify ObjectPropertyChangeSource[prop]
    * notify ObjectHasPropertyChangeSource[prop]
    * notify ObjectOwnKeysChangeSource
* deleteProperty(prop)
    * notify ObjectPropertyChangeSource[prop]
    * notify ObjectHasPropertyChangeSource[prop]
    * notify ObjectOwnKeysChangeSource
* defineProperty(prop)
    * notify ObjectPropertyChangeSource[prop]
    * notify ObjectHasPropertyChangeSource[prop]
    * notify ObjectOwnKeysChangeSource
    * notify ObjectOwnPropertyDescriptorChangeSource[prop]
* getOwnPropertyDescriptor(prop)
    * subscribe to ObjectOwnPropertyDescriptorChangeSource[prop]
* getPrototypeOf()
    * subscribe to ObjectPrototypeOfChangeSource
* setPrototypeOf()
    * notify ObjectPrototypeOfChangeSource
* isExtensible()
    * subscribe to ObjectIsExtensibleChangeSource
* preventExtensions()
    * notify ObjectIsExtensibleChangeSource
* ownKeys()
    * subscribe to ObjectOwnKeysChangeSource
* apply()
    * no change tracking - pass through to target
* construct()
    * no change tracking - pass through to target

### Array Change Sources

Arrays can be treated the same as Objects, since all Array operations translate into the more primitive operations handled by the Object rules described above.

However, this can be an inefficient approach, since it will likely result in many calls to subscribe to individual properties (i.e., array indexes) and many calls to notify subscribers, especially in functions that perform a lot of modifications, like sort or splice.

This level of granularity make sense for applications that are getting and setting individual array elements.  However, applications are more likely simply iterating through the array, once the array has been built up.

With that in mind, Arrays only have a single ChangeSource:

* ArrayChangeSource

All accessors subscribe to ArrayChangeSource, while all mutators notify the ArrayChangeSource.

No special treatment is needed for array methods - they will ultimately call the underlying getters and setters, triggering the appropriate ArrayChangeSource behavior.

When passing through Proxy calls to the target (using Reflect, for example), keep in mind that the "this" must refer to the Proxy receiver, not the target

### Map Change Sources

Maps inherit the ChangeSources and behaviors from Object, described above.  Maps also have these additional ChangeSources:

* MapKeyChangeSource[key]
* MapHasKeyChangeSource[key]
* MapSizeChangeSource
* MapKeysChangeSource
* MapClearChangeSource

Map functions have these additional behaviors:

* get(key)
    * subscribe to MapKeyChangeSource[key]
    * subscribe to MapClearChangeSource
* has(key)
    * subscribe to MapHasKeyChangeSource[key]
    * subscribe to MapClearChangeSource
* size
    * subscribe to MapSizeChangeSource
* set(key, val), delete(key)
    * notify MapKeyChangeSource[key]
    * notify MapHasKeyChangeSource[key]
    * notify MapSizeChangeSource
    * notify MapKeysChangeSource
* clear()
    * notify MapSizeChangeSource
    * notify MapKeysChangeSource
    * notify MapClearChangeSource
* keys(), values(), entries(), forEach(), [Symbol.iterator]
    * subscribe to MapKeysChangeSource

When passing through Proxy calls to the target (using Reflect, for example), keep in mind that the "this" must refer to the target, not the Proxy receiver.

### Set Change Sources

Similar to Maps, Sets also inherit from Object, but add Set-specific ChangeSources and function behaviors:

ChangeSources:

* SetHasChangeSource[key]
* SetSizeChangeSource
* SetKeysChangeSource
* SetClearChangeSource

* has(key)
    * subscribe to SetHasChangeSource[key]
    * subscribe to SetClearChangeSource
* size
    * subscribe to SetSizeChangeSource
* add(key), delete(key)
    * notify SetHasKeyChangeSource[key]
    * notify SetSizeChangeSource
    * notify SetKeysChangeSource
* clear()
    * notify SetSizeChangeSource
    * notify SetKeysChangeSource
    * notify SetClearChangeSource
* values(), entries(), forEach(), [Symbol.iterator]
    * subscribe to SetKeysChangeSource

When passing through Proxy calls to the target (using Reflect, for example), keep in mind that the "this" must refer to the target, not the Proxy receiver.

### Others???

FIXME - are there other objects that should be treated specially?

### Extension Mechanism???

FIXME - allow an application to define its own ChangeProxy behaviors?

## Cached Functions

[Cached Functions](./design.md) are functions that can also act as ChangeSources.  The ChangeDomain.createCachedFunction call internally creates a CachedFunction structure that is available to the cachingFunction (which is the function called by the application).

When CachedFunction.cachingFunction is called:

* subscribe to CachingFunction.changeSource

When the cachingFunction runs and finds that cacheValid is false, it will rerun the original function within ChangeDomain.detectChanges().  The after callback passed to detectChanges should

* mark the CachedFunction as invalid
* notify the CachingFunction.changeSource

