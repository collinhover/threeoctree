threeoctree.js (r56)
========

#### (sparse + dynamic) 3D spatial representation structure for fast searches ####

The aim of this project is to create a fully featured search tree for the [THREE.js WebGL library](http://mrdoob.github.com/three.js/).   
  
```html
This build is stable up to THREE.js ~r56  
(see migration notes below, updates to latest THREE build coming!)  
```
  
## Features

* handle complete objects ( i.e. 1 center position for entire geometry )
* handle object faces ( i.e. split a complex mesh's geometry into a series of pseudo-objects )
* handle both objects and faces together in a single octree
* overlaping nodes to help sort objects that overlap multiple nodes much more efficiently ( overlap is percentage based )
* split ( 1 larger octree node > up to 8 smaller octree nodes )
* merge ( up to 8 smaller octree nodes > 1 larger octree node )
* expand ( 1 smaller octree node > 1 larger octree node + original smaller octree node + up to 7 other smaller octree nodes ) 
* contract ( 1 larger octree node + entire subtree > 1 smaller octree node )
* update ( account for moving objects, trade-off is performance and is not recommended )
* search by position and radius ( i.e. sphere search )
* search by ray using position, direction, and distance/far ( does not include specific collisions, only potential )
* raycast search results using built in THREE.Raycaster additions ( does not modify the Raycaster except to add new functions )
  
## Migration  
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
	depthMax: -1, // optional, default = -1, infinite depth
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
octree.add( object, true );
```

Remove all octree objects associated with three object:  
  
```html
octree.remove( object );
```

#### Search

Search octree at a position in all directions for radius distance:  
  
```html
octree.search( position, radius );
```

Search octree and organize results by object (i.e. all faces belonging to three object in one list vs a result for each face):  
  
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

## Example

The following code shows a working example (see comments for details):   
  
```html
<script>

	var camera, 
		scene, 
		renderer,
		octree,
		geometry, 
		material, 
		mesh,
		meshes = [],
		meshesSearch = [],
		meshCountMax = 1000,
		radius = 500,
		radiusMax = radius * 10,
		radiusMaxHalf = radiusMax * 0.5,
		radiusSearch = 400,
		searchMesh,
		baseR = 255, baseG = 0, baseB = 255,
		foundR = 0, foundG = 255, foundB = 0,
		adding = true;

	init();
	animate();

	function init() {
		
		// standard three scene, camera, renderer

		scene = new THREE.Scene();

		camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, radius * 100 );
		camera.position.z = radius * 20;
		scene.add( camera );

		renderer = new THREE.WebGLRenderer();
		renderer.setSize( window.innerWidth, window.innerHeight );

		document.body.appendChild( renderer.domElement );
		
		// create octree
		
		octree = new THREE.Octree( {
			scene: scene
		} );
		
		// create object to show search radius and add to scene
		
		searchMesh = new THREE.Mesh( new THREE.SphereGeometry( radiusSearch ), new THREE.MeshBasicMaterial( { color: 0x00FF00, transparent: true, opacity: 0.4 } ) );
		scene.add( searchMesh );

	}

	function animate() {

		// note: three.js includes requestAnimationFrame shim
		requestAnimationFrame( animate );
		
		// modify octree structure by adding/removing objects
		
		modifyOctree();
		
		// search octree at random location
		
		searchOctree();
		
		// render results
		
		render();

	}
	
	function modifyOctree() {
		
		// if is adding objects to octree
		
		if ( adding === true ) {
			
			// create new object
			
			geometry = new THREE.CubeGeometry( 50, 50, 50 );
			material = new THREE.MeshBasicMaterial();
			material.color.setRGB( baseR, baseG, baseB );
			
			mesh = new THREE.Mesh( geometry, material );
			
			// give new object a random position in radius
			
			mesh.position.set( Math.random() * radiusMax - radiusMaxHalf, Math.random() * radiusMax - radiusMaxHalf, Math.random() * radiusMax - radiusMaxHalf );
			
			// add new object to octree and scene
			
			octree.add( mesh );
			scene.add( mesh );
			
			// store object for later
			
			meshes.push( mesh );
			
			// if at max, stop adding
			
			if ( meshes.length === meshCountMax ) {
				
				adding = false;
				
			}
			
		}
		// else remove objects from octree
		else {
			
			// get object
			
			mesh = meshes.shift();
			
			// remove from scene and octree
			
			scene.remove( mesh );
			octree.remove( mesh );
			
			// if no more objects, start adding
			
			if ( meshes.length === 0 ) {
				
				adding = true;
				
			}
			
		}
		
		/*
		
		// octree details to console
		
		console.log( ' ============================================================================================================');
		console.log( ' OCTREE: ', octree );
		console.log( ' ... depth ', octree.depth, ' vs depth end?', octree.depth_end() );
		console.log( ' ... num nodes: ', octree.node_count_end() );
		console.log( ' ... total objects: ', octree.object_count_end(), ' vs tree objects length: ', octree.objects.length );
		console.log( ' ============================================================================================================');
		console.log( ' ');
		
		// print full octree structure to console
		
		octree.to_console();
		
		*/
		
	}
	
	function searchOctree() {
		
		var i, il;
		
		// revert previous search objects to base color
		
		for ( i = 0, il = meshesSearch.length; i < il; i++ ) {
			
			meshesSearch[ i ].object.material.color.setRGB( baseR, baseG, baseB );
			
		}
		
		// new search position
		searchMesh.position.set( Math.random() * radiusMax - radiusMaxHalf, Math.random() * radiusMax - radiusMaxHalf, Math.random() * radiusMax - radiusMaxHalf );
		
		// record start time
		
		var timeStart = new Date().getTime();
		
		// search octree from search mesh position with search radius
		// optional third parameter: boolean, if should sort results by object when using faces in octree
		// optional fourth parameter: vector3, direction of search when using ray (assumes radius is distance/far of ray)
		
		var rayCaster = new THREE.Raycaster( new THREE.Vector3().copy( searchMesh.position ), new THREE.Vector3( Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1 ).normalize() );
		meshesSearch = octree.search( rayCaster.ray.origin, radiusSearch, true, rayCaster.ray.direction );
		var intersections = rayCaster.intersectOctreeObjects( meshesSearch );
		
		// record end time
		
		var timeEnd = new Date().getTime();
		
		// set color of all meshes found in search
		
		for ( i = 0, il = meshesSearch.length; i < il; i++ ) {
			
			meshesSearch[ i ].object.material.color.setRGB( foundR, foundG, foundB );
			
		}
		
		/*
		
		// results to console
		
		console.log( 'OCTREE: ', octree );
		console.log( '... searched ', meshes.length, ' and found ', meshesSearch.length, ' with intersections ', intersections.length, ' and took ', ( timeEnd - timeStart ), ' ms ' );
		
		*/
		
	}
	
	function render() {
		
		renderer.render( scene, camera );

	}

</script>
```

---
  
*Copyright (C) 2012 [Collin Hover](http://collinhover.com/)*  
*Based on Dynamic Octree by [Piko3D](http://www.piko3d.com/) and Octree by [Marek Pawlowski](pawlowski.it)*  
*For full license and information, see [LICENSE](https://collinhover.github.com/threeoctree/LICENSE).*   