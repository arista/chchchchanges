# ChangeTransaction

The notification process is more involved than simply calling the callback functions on a ChangeSource's listeners.  The process needs to support "before" and "after" notifications.  The process also needs to account for nested notifications - for example, a notification might trigger a change that itself triggers other notifications.  The process also needs to accommodate notifying multiple ChangeSources.

The overall notification process is represented by a ChangeTransaction.  The ChangeTransaction is scoped to a ChangeDomain, which allows only one ChangeTransaction to be in process at a time.  When a Proxy trap intercepts a call that is going to result in notifications, it wraps its work in a ChangeTransaction, or uses the ChangeTransaction already in place.  It does this using the withTransaction convenience function:

For example, an Object get() trap might look like this:

```
if(changeDomain.changeContext == null) {
  // Perform notifications
  t.notify(the property ChangeSource)
  t.notify(the hasProperty ChangeSource)
  t.notify(the ownKeys ChangeSource)
  
  pass call to target
}
else {
  pass call to target
}
```

The withTransaction creates a new ChangeTransaction for the ChangeDomain if one didn't already exist, then calls the function passed in.  When the function completes, then if withTransaction had created the transaction, it will call complete() on that transaction, then remove it from the ChangeDomain.

Note that it should only do all this if the ChangeDomain is not in the middle of a detectChanges call (changeContext == null).  Otherwise it should bypass all this logic and just pass the call to the target.

Note that the ChangeSources are given to the transaction **before** the target is called to make the actual change.  This allows the transaction to perform any before notifications, while deferring any after notifications until the transaction is complete.

When notify() is called on the ChangeTransaction, it goes through these steps:

* Add the ChangeSource to transaction's set of ChangeSources
* make a copy of the list of subscribers for that ChangeSource, then clear that list (ChangeSource.listAndClearListeners)
* for each ChangeListener that is not marked as wasNotified
    * mark the listener as wasNotified
    * unsubscribe that listener from all its ChangeSources
    * if the listener has a "before" callback
        * call that function - keep in mind that this could recursively make calls that trigger notifications, that could potentially add to the transaction
        * if it returns another function, add that function to the transaction's afterNotifications
    * else if the listener has an "after" callback
        * add that function to the transaction's afterNotifications

Once the final withTransaction() completes, it will call complete() on the transaction, which does the following:

* go through all of the afterNotifications registered with the transaction
    * call the afterNotification callback
* keep in mind that the callbacks could themselves be triggering more changes and notifications, which means that the list of afterNotifications might continue to grow
* go through each of the transaction's set of ChangeSources
    * for each ChangeSource, if it has no listeners, call its remove() method

TBD - figure out a way to detect dependency cycles
