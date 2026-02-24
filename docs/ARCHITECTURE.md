# Architecture

## Overview

The primary purpose of the library is to allow a JS function to run while identifying dependencies on "change-enabled" values, then providing a notification when any of those values changes.  Values are "change-enabled" by wrapping them in Proxies, then intercepting calls that reveal a dependency (e.g., getters), or signal a change (e.g., setters).

## Key Concepts

### Change-Sensitive Function

The main use case for the library is to allow an application to execute a function, then be notified when some value accessed by that function is modified.  Such a function is called a **Change-Sensitive Function**.

A function becomes Change-Sensitive simply by executing it in a **Change Context** provided by the library.  That context provides the machinery to identify and register dependencies used by that function.  The function itself does not need to be written in any special way, nor does it even need to know that it is intended to be Change-Sensitive.

### Change Context

As mentioned above, a **Change Context** is the mechanism presented to the application for running Change-Sensitive Functions.  The application requests a Change Context from the library, then runs the function using that context, providing a callback function to be invoked when any of the Change-Sensitive Function's dependencies change.

The Change Context can also provide some debugging help, such as providing a notification whenever a dependency is identified as the function runs.

### ChangeSource and ChangeListener

A **ChangeSource** represents a value that can potentially become a dependency of a Change-Senstive Function.  This can represent a property of an Object, the length of an array, etc.

The primary function of a ChangeSource is to publish a notification when its underlying value changes.  The notification is received by **ChangeListener**s that have been registered with the ChangeSource.  A function with dependencies would, for example, have an associated ChangeListener subscribed to each of the relevant ChangeSources.

Whenever a ChangeSource publishes to its subscribed ChangeListeners, it clears that list of listeners.  ChangeListeners need to re-subscribe to the ChangeSource if they want further notifications.

The main use case is a function that runs, while the system subscribes ChangeListeners to any ChangeSources it identifies as dependencies along the way.  If a ChangeSource publishes a change, then it is expected that the function will be re-run, thereby re-subscribing a new list of ChangeListeners.

### ChangeProxy

A **ChangeProxy** is a JS Proxy that intercepts application calls to an Object, using those calls to identify ChangeSources, and to notify listeners when the underlying values of those ChangeSources changes.

The main idea is that a Change-Sensitive Function can access application objects without knowing about ChangeSources, ChangeListeners, or even that this library is involved.  As long as all the values accessed by the function are wrapped in ChangeProxies, the function will be none the wiser.

A key property of the ChangeProxy is to make sure all values it returns to the application are themselves wrapped in ChangeProxies.  When a ChangeProxy intercepts a call, it will wrap all of its incoming arguments in ChangeProxies, and wrap its return value in a ChangeProxy.  Ideally, the application would only need to wrap one "root" object in a ChangeProxy, and all other objects the application encounters will automatically be wrapped as well.

Once a ChangeProxy has been created for an Object, the two will be permanently associated with each other.  Special Symbol getters will allow the library to check for the existence of an Object's Proxy, and to navigate back and forth between the original Object and its Proxy.  Once the association has been made, "wrapping" an Object in a Proxy should essentially become a noop.

### ChangeDomain

A **ChangeDomain** represents the scope of dependencies and changes that can be associated with a Change-Sensitive Function.

The library can create multiple ChangeDomains.  A ChangeDomain then becomes the application's main API for its two main functions: wrapping an Object in a ChangeProxy, and running a Change-Sensitive Function in a ChangeContext.

When the application uses a ChangeDomain to wrap an Object in a ChangeProxy, that ChangeProxy remembers its association with that ChangeDomain.  When that ChangeProxy wraps other values (arguments or return values) in proxies, those new ChangeProxies will also be associated with that ChangeDomain.

When an application obtains a ChangeContext from a ChangeDomain, then runs a Change-Sensitive Function in that ChangeContext, it will only identify dependencies for Objects that are associated with that ChangeDomain.

An Object can only be associated with one ChangeDomain.  If an attempt is made to wrap an Object in a ChangeProxy from another ChangeDomain, the result will be an error.

While the application can explicitly create ChangeDomains, there is also an implicit global ChangeDomain, that is used by default.  Most applications will likely stick to using that global ChangeDomain, but if an application for some reason needs to "segment" changes, it can use this ChangeDomain mechanism.

### Cached Function

A **Cached Function** is a particular application of the system.  A Cached Function, when initially evaluated, executes with its own Change Context.  This means that it results in a value, which is cached, plus a registered callback which invalidates the cached value if any of the function's dependencies change.  When the function is evaluated again, it either returns the cached value, or it re-evaluates within another ChangeContext if its cached value was invalidated.

Additionally, a Cached Function acts as a Change Source.  If a Change Context is in place when the Cached Function is called, then the context's ChangeListener will subscribe to that Change Source.  If the Cached Function is invalidated by a notification, then it will also notify its own Change Source.

This can be used as a way to prevent too much "fan out" in dependencies.  For example, if A and B both call C, and C depends on D, E and F, then normally both A and B would have dependencies on D, E, and F.  But if C becomes a Cached Function, it effectively "gathers up" its own dependencies, so that A and B only depend on C, and C depends on D, E, and F.

The function wrapped by a Cached Function must take no parameters.  A Cached Function is obtained from a ChangeContext by passing in that underlying function.  A Cached Function will automatically wrap its result in a ChangeProxy.

## ChangeSource Details

The bulk of the system is the work done by the ChangeProxies and the ChangeSources they expose.  These are detailed in [ChangeSources](./change-sources.md)

## Technical Design

The API and internal design are [detailed here](./design.md)
