# Design

Technical design

## API

```
interface Changes {
  createDomain(): ChangeDomain
  get globalDomain(): ChangeDomain
}

interface ChangeDomain {
  enableChanges<T>(val: T): T
  detectChanges<T>(f: ()=>T, onChange: ()=>void)
  createCachedFunction<T>(f: ()=>T): ()=>T
}
```

## Internal functions and structures

```
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
  
  changeDomain: ChangeDomain
  
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
  mapSize: ChangeSource|null
  mapKeys: ChangeSource|null
  mapClear: ChangeSource|null
}

```
