threeoctree.js (r60)
========

#### (sparse + dynamic) 3D spatial representation structure for fast searches ####

The aim of this project is to create a fully featured search tree for the [THREE.js WebGL library](http://mrdoob.github.com/three.js/).   
  
```html
This build is stable up to THREE.js ~r60
(updates to latest THREE build on hold as my time is required on other projects)  
```
  
## Features (+ [Example](http://collinhover.github.com/threeoctree))

* handle complete objects ( i.e. 1 center position for entire geometry )
* handle object faces ( i.e. split a complex mesh's geometry into a series of pseudo-objects )
* handle both objects and faces together in a single octree
* overlaping nodes to help sort objects that overlap multiple nodes much more efficiently ( overlap is percentage based )
* split ( 1 larger octree node > up to 8 smaller octree nodes )
* merge ( up to 8 smaller octree nodes > 1 larger octree node )
* expand ( 1 smaller octree node > 1 larger octree node + original smaller octree node + up to 7 other smaller octree nodes ) 
* contract ( 1 larger octree node + entire subtree > 1 smaller octree node )
* rebuild ( account for moving objects, trade-off is performance and is not recommended )
* search by position and radius ( i.e. sphere search )
* search by ray using position, direction, and distance/far ( does not include specific collisions, only potential )
* raycast search results using built in THREE.Raycaster additions ( does not modify the Raycaster except to add new functions )
    
## Needs

* reworking / optimization of insert and removal ( currently we have to force a transform update in case the object is added before first three update )

## Migration  
#### r56 → r60  
- Octree can now handle vertices (and particle systems)  
- `add` method now takes a options object as the second parameter, which may contain booleans for `useFaces` and `useVertices`  
- `OctreeObjectData.usesFaces` removed, use `.faces`, `.face3`, or `.face4`  
- `OctreeObjectData.getFaceBoundingRadius` split into `.getFace3BoundingRadius` and `getFace4BoundingRadius` 
- `OctreeObjectData.vertices` added  
#### r51 → r56  
- Function naming conventions from `hello_world()` to THREE style `helloWorld()`  
- Script renamed from `ThreeOctree.js` to `threeoctree.js`  
- `Ray.intersectOctreeObjects/intersectOctreeObject` to `Raycaster.intersectOctreeObjects/intersectOctreeObject`  
- `Vector3/Matrix4` functions from THREE r51 to r56 ( see: https://github.com/mrdoob/three.js/wiki/Migration )  
  
## Usage

Download the [minified script](https://github.com/collinhover/threeoctree/blob/master/threeoctree.min.js) and include it in your html after the [THREE.js WebGL library](http://mrdoob.github.com/three.js/).

```html
<script src="js/three.min.js"></script>
<script src="js/threeoctree.min.js"></script>
```

#### Initialize

```html
var octree = new THREE.Octree({
	radius: radius, // optional, default = 1, octree will grow and shrink as needed
	undeferred: false, // optional, default = false, octree will defer insertion until you call octree.update();
	depthMax: Infinity, // optional, default = Infinity, infinite depth
	objectsThreshold: 8, // optional, default = 8
	overlapPct: 0.15, // optional, default = 0.15 (15%), this helps sort objects that overlap nodes
	scene: scene // optional, pass scene as parameter only if you wish to visualize octree
} );
```

#### Add/Remove Objects

Add three object as single octree object:  
  
```html
octree.add( object );
```
  
Add three object's faces as octree objects:  
  
```html
octree.add( object, { useFaces: true } );
```
  
Add three object's vertices as octree objects:  
  
```html
octree.add( object, { useVertices: true } );
```
( note that only vertices OR faces can be used, and useVertices overrides useFaces )

Add generic object with x, y, z position and radius and id reference to 3D object:

```html
var object = {x: x, y: y, z: z, radius: radius, id: id}
octree.add( object );
```
( note this method can improve performance if you need to load the tree with tens of thousands of objects )

Remove all octree objects associated with three object:  
  
```html
octree.remove( object );
```

#### Update
  
When `octree.add( object )` is called and `octree.undeferred != true`, insertion for that object is deferred until the octree is updated. Update octree to insert all deferred objects **after render cycle** to makes sure object matrices are up to date.  
```html
renderer.render( scene, camera );
octree.update();
```

#### Rebuild

To account for moving objects within the octree:  
```html
octree.rebuild();
```
  
#### Search

Search octree at a position in all directions for radius distance:  
  
```html
octree.search( position, radius );
```

Search octree and organize results by object (i.e. all faces/vertices belonging to three object in one list vs a result for each face/vertex):  
  
```html
octree.search( position, radius, true );
```

Search octree using a ray:  
  
```html
octree.search( ray.origin, ray.far, true, ray.direction );
```

#### Intersections

This octree adds two functions to the THREE.Raycaster class to help use the search results: .intersectOctreeObjects(), and .intersectOctreeObject(). In most cases you will use only the former:  
  
```html
var octreeResults = octree.search( rayCaster.ray.origin, rayCaster.ray.far, true, rayCaster.ray.direction )
var intersections = rayCaster.intersectOctreeObjects( octreeResults );
```

If you wish to get an intersection from a user's mouse click, this is easy enough:

```html
function onClick ( event ) {
	
	// record mouse x/y position as a 3D vector
	
	var mousePosition = new THREE.Vector3();
	mousePosition.x = ( event.pageX / window.innerWidth ) * 2 - 1;
	mousePosition.y = -( event.pageY / window.innerHeight ) * 2 + 1;
	mousePosition.z = 0.5;

	// use THREE.Projector to unproject mouse position into scene via camera
	
	var projector = new THREE.Projector();
	projector.unprojectVector( mousePosition, camera );

	// create new ray caster
	// origin is camera position
	// direction is unprojected mouse position - camera position
	
	var origin = new THREE.Vector3().copy( camera.position );
	var direction = new THREE.Vector3().copy( mousePosition.sub( camera.position ) ).normalize();
	var rayCaster = new THREE.Raycaster( origin, direction );

	// now search octree and find intersections using method above
	...
	
}
```

---
  
*Copyright (C) 2012 [Collin Hover](http://collinhover.com/)*  
*Based on Dynamic Octree by [Piko3D](http://www.piko3d.com/) and Octree by [Marek Pawlowski](pawlowski.it)*  
*For full license and information, see [LICENSE](https://collinhover.github.com/threeoctree/LICENSE).*   
