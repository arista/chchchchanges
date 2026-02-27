# Design

Technical design

## API

```
Changes {
  createDomain(): ChangeDomain
  get globalDomain(): ChangeDomain

  // Shorthand for calling these functions on the globalDomain
  enableChanges<T>(val: T): T
  detectChanges<T>(f: ()=>T, onChange: ChangeCallback)
  createCachedFunction<T>(f: ()=>T): CachedFunction
  subscribe<T extends Object>(obj T, listener: ChangeListener): T
  unsubscribe<T>(T, listener)
}

ChangeDomain {
  // Returns a "change-enabled" form of val that should be used going forward by the application in place of val.  A non-Object value, or a value already change-enabled, will be returned as-is, otherwise the value will be wrapped in a ChangeProxy, allowing it to report changes when accessed by functions called through detectChanges.  Any values returned through the change-enabled Object will also be passed through enableChanges.
  enableChanges<T>(val: T): T

  // Executes the given function, while watching for any dependencies on change-enabled values (i.e., values passed through enableChanges).  If one of those dependencies changes later, the onChange callback will be executed.  If detectChanges is already running when this is called, the former will call will be "suspended" while this one runs, then will be resumed when that call completes.  The function must be synchronous - async functions are not supported.
  detectChanges<T>(f: ()=>T, onChange: ChangeCallback): ChangeDetecting<T>

  // Shorthand for "wrapping" a function in a new function that caches the result of executing f(), while also watching for any changes in dependencies.  The resulting function also acts as a ChangeSource, which means that it can be recorded as a dependency by detectChanges.
  createCachedFunction<T>(f: ()=>T): ()=>T

  subscribe<T extends Object>(obj T, listener: ChangeListener): T
  unsubscribe<T>(T, listener)
}

// Defines a callback that should be called either before the change has taken effect, or after the change has taken effect.  Defaults to after.  If before, the function has the opportunity to return a function that should also be called after the change has taken effect.

ChangeCallback =
  AfterChangeCallback
  | {before: BeforeChangeCallback}
  | {after: AfterChangeCallback}
BeforeChangeCallback = ()=>void|AfterCallback
AfterChangeCallback = ()=>void

// The result of calling detectChanges.  Contains the result of calling the original function, plus a remove() function that should be called if change detection is no longer needed.
// The need for remove() arises because calling detectChanges creates connections back to the app through callbacks.  If the app no longer needs the notifications from those callbacks, it can try to release its references to whatever component was listening to those callbacks, but that won't release the references from the ChangeSources to the callbacks.  Hence, the need for a remove() call.
// Note that even if an app doesn't call remove(), eventually the listeners will be released the next time a notification is called.
ChangeDetecting<T> {
  result: T
  remove()
}

CachedFunction<T> {
  // Execute the cached function, 
  call(): T

  // Similar to ChangeDetecting.remove(), this "disconnects" the CachedFunction from any other future notifications.  This should be called when the CachedFunction is no longer needed, to avoid memory leaks
  remove()

  // Adds a listener that will be notified whenever the CachedFunction receives a notification that its cached value has been invalidated
  addListener(listener: CachedFunctionListener)

  // Removes a previously-added listener (ignore if the listener was not added)
  removeListener(listener: CachedFunctionListener)
}

CachedFunctionListener = ()=>void

```

See [subscriptions](./subscriptions.md) for an explanation of the ChangeDomain.subscribe/unsubscribe methods.

## Internal functions and structures

```
// Internal ChangeDomain functions
ChangeDomain {
  withTransaction<R>(f: (ChangeTransaction)=>R): R

  changeContext: ChangeContext|null
}

// The context maintained by a ChangeDomain when detectChanges is called.  If detectChanges is called when a changeContext is already in effect, then a new ChangeContext will be put in place, then replaced with the old ChangeContext when complete
ChangeContext {
  onChange: ChangeCallback
}

CachedFunction<T> {
  originalFunction: ()=>T
  cachingFunction: ()=>T
  cacheValid: boolean
  cachedValue: T|null
  changeSource: ChangeSource|null
}

ChangeProxy<T, CS extends ChangeSources> {
  // The Proxy
  proxy: T
  // The original Object passed to enableChanges
  target: T

  // The ChangeDomain through which this proxy was created
  changeDomain: ChangeDomain

  // The ChangeSources managed by the Proxy reflecting subscriptions to changes in the underlying objects
  changeSources: CS|null
}

PropertyKey = string|Symbol

ChangeSources {
}

ObjectChangeSources extends ChangeSources {
  prototypeOf: ChangeSource|null
  isExtensible: ChangeSource|null
  ownPropertyDescriptor: Map<PropertyKey,ChangeSource>|null
  hasProperty: Map<PropertyKey,ChangeSource>|null
  property: Map<PropertyKey,ChangeSource>|null
  ownKeys: ChangeSource|null
}

ArrayChangeSources extends ChangeSources {
  array: ChangeSource|null
}

MapChangeSources extends ObjectChangeSources {
  mapKey: Map<any, ChangeSource>|null
  mapHasKey: Map<any, ChangeSource>|null
  mapSize: ChangeSource|null
  mapKeys: ChangeSource|null
  mapClear: ChangeSource|null
}

SetChangeSources extends ObjectChangeSources {
  setHas: Map<any, ChangeSource>|null
  setSize: ChangeSource|null
  setKeys: ChangeSource|null
  setClear: ChangeSource|null
}


// A subscribable source of notifications for possible changes to a value
ChangeSource {
  // Adds a listener to be notified when the value may have changed.  Will only add a particular listener once, even if subscribe is called multiple times for the same listener
  subscribe(listener: ChangeListener)

  // Removes a listener from the list of subscribers.  Ignored if the listener is not a subscriber
  unsubscribe(listener: ChangeListener)

  // Return the current list of listeners, then clear the list internally
  listAndClearListeners(): Array<ChangeListener>

  // The ChangeDomain managing this source
  changeDomain: ChangeDomain

  // Function to be called if a ChangeSource is found to be empty at the end of a transaction and can be removed
  remove: ()=>void
}

// Represents one ChangeListener registered with a ChangeSource.
ChangeSubscription {
  source: ChangeSource
  listener: ChangeListener
}

// Represents an entity interested in receiving notifications from ChangeSources.  A ChangeListener can listen to multiple ChangeSources.  A ChangeListener can only be used once - once notified, a ChangeListener must be replaced with a new ChangeListener.
ChangeListener {
  wasNotified: boolean

  callback: ChangeCallback

  // Unsubscribe the listener from all previously-subscribed ChangeSources
  unsubscribe()
  
  subscriptions: Array<ChangeSubscription>
}


ChangeTransaction {
  afterNotifications: Array<ChangeTransactonAfterNotification>
  changeSources: Set<ChangeSource>

  notify(ChangeSource|null)
  complete()
}

ChangeTransactionAfterNotification {
  listener: ChangeListener
  after: AfterChange
}

```
