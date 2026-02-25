# ChangeTransaction

The notification process is more involved than simply calling the callback functions on a ChangeSource's listeners.  The process needs to support "before" and "after" notifications.  The process also needs to account for nested notifications - for example, a notification might trigger a change that itself triggers other notifications.  The process also needs to accommodate notifying multiple ChangeSources.

The overall notification process is represented by a ChangeTransaction.  The ChangeTransaction is scoped to a ChangeDomain, which allows only one ChangeTransaction to be in process at a time.  When a Proxy trap intercepts a call that is going to result in notifications, it wraps its work in a ChangeTransaction, or uses the ChangeTransaction already in place.  It does this using the withTransaction convenience function:

For example, an Object set() trap might look like this:

```
if(changeDomain.changeContext != null) {
  // Inside a detectChanges call - skip notifications, just pass through
  pass call to target
}
else {
  changeDomain.withTransaction(t => {
    // Perform notifications before calling the target
    t.notify(the property ChangeSource)
    t.notify(the hasProperty ChangeSource)
    t.notify(the ownKeys ChangeSource)

    pass call to target
  })
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

* iterate through afterNotifications using an index, starting at 0
    * call the afterNotification callback at the current index
    * increment the index
    * callbacks may trigger more changes and notifications, which may append new entries to the afterNotifications list - these will be processed as the index advances past the original length
* only after all afterNotifications have been processed (including any added during processing), go through each of the transaction's set of ChangeSources
    * for each ChangeSource, if it has no listeners, call its remove() method

## Cross-Domain Restrictions

It is an error for a callback triggered during a ChangeTransaction to modify a change-enabled object belonging to a different ChangeDomain.  If a proxy trap detects that another ChangeDomain already has a transaction in progress, it should throw an error.

This avoids the complexity of cross-domain transaction ordering and potential circular interactions between domains.  If two domains are coupled enough that one domain's callbacks need to modify the other domain's state, they should likely be the same domain.  If cross-domain propagation is truly needed, the callback can defer the modification outside the transaction (e.g., via `setTimeout` or `queueMicrotask`).

## Dependency Cycles

The above iteration strategy means that if after-callbacks continuously trigger changes that produce new after-callbacks, the transaction will never complete.  The `wasNotified` flag on ChangeListeners prevents a single listener from being notified twice in the same transaction, but it does not prevent cycles that arise from after-callbacks re-running functions (via `detectChanges`), which create *new* listeners that then get triggered by further changes in the same transaction.  Each new listener has its own `wasNotified` flag, so the cycle is not caught.

TBD - figure out a way to detect these cycles
