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

## Object Change Sources

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
    * subscribe to ObjectOwnPropertyChangeSource[prop]
* getPrototypeOf()
    * subscribe to ObjectPropertyChangeSource
* setPrototypeOf()
    * notify ObjectPropertyChangeSource
* isExtensible()
    * subscribe to ObjectIsExtensibleChangeSource
* preventExtensions()
    * notify ObjectIsExtensibleChangeSource
* ownKeys()
    * subscribe to ObjectOwnKeysChangeSource
* apply()
* construct()

## Array Change Sources

FIXME - specify this

## Map Change Sources

FIXME - specify this

## Set Change Sources

FIXME - specify this

## Others???

FIXME - are there other objects that should be treated specially?

## Extension Mechanism???

FIXME - allow an application to define its own ChangeProxy behaviors?

