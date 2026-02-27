# Subscriptions

The library allows an application to subscribe directly to changes on individual objects.  This allows a dependent value to make finer-grained responses than would be possible if that value was only told that some dependent changed.

```
ChangeDomain {
  subscribe<T extends Object>(obj T, listener: ChangeListener): T
  unsubscribe<T>(T, listener)
}

ChangeListener =
  AfterChangeListener
  | {before: BeforeChangeListener}
  | {after: AfterChangeListener}
BeforeChangeListener = (change:Change)=>void|AfterCallback
AfterChangeListener = (change:Change)=>void

ChangeListener = (change: Change)=>void
```

The subscribe method takes an object and adds a function that will be called for each change made on that object.  The object is first change-enabled, and the result of that is returned.  The unsubscribe method removes a listener (ignoring if the listener hasn't been added).

The notification lifecycle is similar to the callbacks supplied to detectChanges, where "before" notifications are sent before a change is made, and "after" notifications are sent at the end of a transaction.

## Changes

The actual changes that can be reported depend on the type of object subscribed to.  The type system, however, does not distinguish between the object types, and instead gathers all possible changes into a single Change type.

### Object

An Object's changes basically reflect the traps on a Proxy:

```
{
  type: "ObjectSetPrototypeOf"
  target
  prototype
}

{
  type: "ObjectPreventExtensions"
  target
  prototype
}

{
  type: "ObjectDefineProperty"
  target
  key
  descriptor
}

{
  type: "ObjectSet"
  target
  prop
  value
}
```

### Array

Array changes inherit the Object changes above.  However, when array mutator methods are called, reporting of those lower-level changes is suppressed, and the higher-level mutation calls are reported instead.

```
{
  type: "ArrayFill"
  target
  value
  start
  end
}

{
  type: "ArrayCopyWithin"
  target
  start
  end
}

{
  type: "ArrayPop"
  target
}

{
  type: "ArrayPush"
  target
  elements
}

{
  type: "ArrayReverse"
  target
}

{
  type: "ArraySort"
  target
}

{
  type: "ArraySplice"
  target
  start
  deleteCount
  items?
}

```

### Map

Map changes mirror the Map's API:

```
{
  type: "MapClear"
  target
}

{
  type: "MapDelete"
  target
  key
}

{
  type: "MapSet"
  target
  key
  value
}

```

### Set

Set changes mirror the Set's API:

```
{
  type: "SetClear"
  target
}

{
  type: "SetDelete"
  target
  value
}

{
  type: "SetAdd"
  target
  value
}
```
