/*
 *
 * ThreeOctree.js
 * (sparse) dynamic 3D spatial representation structure for fast searches.
 * 
 * @author Collin Hover / http://collinhover.com/
 * based on Dynamic Octree by Piko3D @ http://www.piko3d.com/ and Octree by Marek Pawlowski @ pawlowski.it 
 *
 * Licensed under the terms of the GNU General Public License and is free software.
 *
 * Octree capabilities:
 * - handle complete objects ( i.e. 1 center position for entire geometry )
 * - handle object faces ( i.e. split a complex mesh's geometry into a series of pseudo-objects )
 * - handle both objects and faces together in a single octree
 * - split ( 1 larger octree node > up to 8 smaller octree nodes )
 * - merge ( up to 8 smaller octree nodes > 1 larger octree node )
 * - expand ( 1 smaller octree node > 1 larger octree node + original smaller octree node + up to 7 other smaller octree nodes ) 
 * - contract ( 1 larger octree node + entire subtree > 1 smaller octree node )
 * - update ( account for moving objects, trade-off is performance and is not recommended )
 * - search by position and radius ( i.e. sphere search )
 * - search by ray ( uses ray position, direction, and distance/far )
 *
 */

/*===================================================

octree

=====================================================*/

THREE.Octree = function ( parameters ) {
	
	// handle parameters
	
	parameters = parameters || {};
	
	parameters.tree = this;
	
	// static properties ( modification is not recommended )
	
	this.nodeCount = 0;
	
	this.INDEX_INSIDE_CROSS = -1;
	this.INDEX_OUTSIDE_OFFSET = 2;
	
	this.INDEX_OUTSIDE_POS_X = this.is_number( parameters.INDEX_OUTSIDE_POS_X ) ? parameters.INDEX_OUTSIDE_POS_X : 0;
	this.INDEX_OUTSIDE_NEG_X = this.is_number( parameters.INDEX_OUTSIDE_NEG_X ) ? parameters.INDEX_OUTSIDE_NEG_X : 1;
	this.INDEX_OUTSIDE_POS_Y = this.is_number( parameters.INDEX_OUTSIDE_POS_Y ) ? parameters.INDEX_OUTSIDE_POS_Y : 2;
	this.INDEX_OUTSIDE_NEG_Y = this.is_number( parameters.INDEX_OUTSIDE_NEG_Y ) ? parameters.INDEX_OUTSIDE_NEG_Y : 3;
	this.INDEX_OUTSIDE_POS_Z = this.is_number( parameters.INDEX_OUTSIDE_POS_Z ) ? parameters.INDEX_OUTSIDE_POS_Z : 4;
	this.INDEX_OUTSIDE_NEG_Z = this.is_number( parameters.INDEX_OUTSIDE_NEG_Z ) ? parameters.INDEX_OUTSIDE_NEG_Z : 5;
	
	this.INDEX_OUTSIDE_MAP = [];
	this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_POS_X ] = { index: this.INDEX_OUTSIDE_POS_X, count: 0, x: 1, y: 0, z: 0 };
	this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_NEG_X ] = { index: this.INDEX_OUTSIDE_NEG_X, count: 0, x: -1, y: 0, z: 0 };
	this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_POS_Y ] = { index: this.INDEX_OUTSIDE_POS_Y, count: 0, x: 0, y: 1, z: 0 };
	this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_NEG_Y ] = { index: this.INDEX_OUTSIDE_NEG_Y, count: 0, x: 0, y: -1, z: 0 };
	this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_POS_Z ] = { index: this.INDEX_OUTSIDE_POS_Z, count: 0, x: 0, y: 0, z: 1 };
	this.INDEX_OUTSIDE_MAP[ this.INDEX_OUTSIDE_NEG_Z ] = { index: this.INDEX_OUTSIDE_NEG_Z, count: 0, x: 0, y: 0, z: -1 };
	
	this.FLAG_POS_X = 1 << ( this.INDEX_OUTSIDE_POS_X + 1 );
	this.FLAG_NEG_X = 1 << ( this.INDEX_OUTSIDE_NEG_X + 1 );
	this.FLAG_POS_Y = 1 << ( this.INDEX_OUTSIDE_POS_Y + 1 );
	this.FLAG_NEG_Y = 1 << ( this.INDEX_OUTSIDE_NEG_Y + 1 );
	this.FLAG_POS_Z = 1 << ( this.INDEX_OUTSIDE_POS_Z + 1 );
	this.FLAG_NEG_Z = 1 << ( this.INDEX_OUTSIDE_NEG_Z + 1 );
	
	// pass scene to see octree structure
	
	this.scene = parameters.scene;
	
	// properties
	
	this.objects = [];
	this.objectsData = [];
	
	this.depthMax = this.is_number( parameters.depthMax ) ? parameters.depthMax : -1;
	this.objectsThreshold = this.is_number( parameters.objectsThreshold ) ? parameters.objectsThreshold : 8;
	this.overlapPct = this.is_number( parameters.overlapPct ) ? parameters.overlapPct : 0.15;
	
	this.root = parameters.root instanceof THREE.OctreeNode ? parameters.root : new THREE.OctreeNode( parameters );
	
}

THREE.Octree.prototype = {
	
	is_number: function ( n ) {
		return !isNaN( n ) && isFinite( n );
	},
	
	root_set: function ( root ) { 
		
		if ( root instanceof THREE.OctreeNode ) {
			
			// store new root
			
			this.root = root;
			
			// update properties
			
			this.root.properties_update_cascade();
			
		}
		
	},
	
	add: function ( object, useFaces ) {
		
		var i, l,
			index,
			geometry,
			faces,
			objectData;
		
		// ensure object is not object data
		
		if ( object instanceof THREE.OctreeObjectData ) {
			
			object = object.object;
			
		}
		
		// if does not yet contain object
		
		index = this.objects.indexOf( object );
		
		if ( index === -1 ) {
			
			// store
			
			this.objects.push( object );
			
			// ensure world matrices are updated
			
			this.update_object_world_matrix( object );
			
			// if adding faces of object
			
			if ( useFaces === true ) {
				
				geometry = object.geometry;
				faces = geometry.faces;
				
				for ( i = 0, l = faces.length; i < l; i++ ) {
					
					this.add_object_data( object, faces[ i ] );
					
				}
				
			}
			// else add object itself
			else {
				
				this.add_object_data( object );
				
			}
			
		}
		
	},
	
	add_object_data: function ( object, face ) {
		
		var objectData = new THREE.OctreeObjectData( object, face );
		
		// add to tree objects data list
		
		this.objectsData.push( objectData );
		
		// add to nodes
		
		this.root.add_object( objectData );
		
	},
	
	remove: function ( object ) {
		
		var i, l,
			objectData = object,
			index,
			objectsDataRemoved;
		
		// ensure object is not object data for index search
		
		if ( object instanceof THREE.OctreeObjectData ) {
			
			object = object.object;
			
		}
		
		// if contains object
		
		index = this.objects.indexOf( object );
		
		if ( index !== -1 ) {
			
			// remove from objects list
			
			this.objects.splice( index, 1 );
			
			// remove from nodes
			
			objectsDataRemoved = this.root.remove_object( objectData );
			
			// remove from objects data list
			
			for ( i = 0, l = objectsDataRemoved.length; i < l; i++ ) {
				
				objectData = objectsDataRemoved[ i ];
				
				index = this.objectsData.indexOf( objectData );
				
				if ( index !== -1 ) {
					
					this.objectsData.splice( index, 1 );
					
				}
				
			}
			
		}
		
	},
	
	extend: function ( octree ) {
		
		var i, l,
			objectsData,
			objectData;
			
		if ( octree instanceof THREE.Octree ) {
			
			// for each object data
			
			objectsData = octree.objectsData;
			
			for ( i = 0, l = objectsData.length; i < l; i++ ) {
				
				objectData = objectsData[ i ];
				
				this.add( objectData, objectData.useFaces );
				
			}
			
		}
		
	},
	
	update: function () {
		
		var i, l,
			node,
			object,
			objectData,
			indexOctant,
			indexOctantLast,
			objectsUpdate = [];
		
		// update all objects
		
		for ( i = 0, l = this.objects.length; i < l; i++ ) {
			
			object = this.objects[ i ];
			
			// ensure world matrices are updated
			
			this.update_object_world_matrix( object );
			
		}
		
		// check all object data for changes in position
		
		for ( i = 0, l = this.objectsData.length; i < l; i++ ) {
			
			objectData = this.objectsData[ i ];
			
			node = objectData.node;
			
			// update object
			
			objectData.update();
			
			// if position has changed since last organization of object in tree
			
			if ( node instanceof THREE.OctreeNode && !objectData.positionLast.equals( objectData.position ) ) {
				
				// get octant index of object within current node
				
				indexOctantLast = objectData.indexOctant;
				
				indexOctant = node.octant_index( objectData );
				
				// if object octant index has changed
				
				if ( indexOctant !== indexOctantLast ) {
					
					// add to update list
					
					objectsUpdate.push( objectData );
					
				}
				
			}
			
		}
		
		// update changed objects
		
		for ( i = 0, l = objectsUpdate.length; i < l; i++ ) {
			
			objectData = objectsUpdate[ i ];
			
			// remove object from current node
			
			objectData.node.remove_object( objectData );
			
			// add object to tree root
			
			this.root.add_object( objectData );
			
		}
		
	},
	
	search: function ( position, radius, organizeByObject, direction ) {
		
		var i, l,
			node,
			objects,
			objectData,
			object,
			results,
			resultData,
			resultsObjectsIndices,
			resultObjectIndex;
		
		// add root objects
		
		objects = [].concat( this.root.objects );
		
		// search each node of root
		
		for ( i = 0, l = this.root.nodesIndices.length; i < l; i++ ) {
			
			node = this.root.nodesByIndex[ this.root.nodesIndices[ i ] ];
			
			objects = node.search( position, radius, objects, direction );
			
		}
		
		// if should organize results by object
		
		if ( organizeByObject === true ) {
			
			results = [];
			resultsObjectsIndices = [];
			
			// for each object data found
			
			for ( i = 0, l = objects.length; i < l; i++ ) {
				
				objectData = objects[ i ];
				object = objectData.object;
				
				resultObjectIndex = resultsObjectsIndices.indexOf( object );
				
				// if needed, create new result data
				
				if ( resultObjectIndex === -1 ) {
					
					resultData = {
						object: object,
						faces: []
					};
					
					results.push( resultData );
					
					resultsObjectsIndices.push( object );
					
				}
				else {
					
					resultData = results[ resultObjectIndex ];
					
				}
				
				// if object data has face, add to list
				
				if ( typeof objectData.faces !== 'undefined' ) {
					
					resultData.faces.push( objectData.faces );
					
				}
				
			}
			
		}
		else {
			
			results = objects;
			
		}
		
		return results;
		
	},
	
	update_object_world_matrix: function ( object ) {
		
		var i, l,
			parentCascade = [ object ],
			parent,
			parentUpdate
		
		// search all parents between object and root for world matrix update
		
		parent = object.parent;
		
		while( parent ) {
			
			parentCascade.push( parent );
			parent = parent.parent;
			
		}
		
		for ( i = 0, l = parentCascade.length; i < l; i++ ) {
			
			parent = parentCascade[ i ];
			
			if ( parent.matrixWorldNeedsUpdate === true ) {
				
				parentUpdate = parent;
				
			}
			
		}
		
		// update world matrix starting at uppermost parent that needs update
		
		if ( typeof parentUpdate !== 'undefined' ) {
			
			parentUpdate.updateMatrixWorld();
			
		}
		
	},
	
	depth_end: function () {
		
		return this.root.depth_end();
		
	},
	
	node_count_end: function () {
		
		return this.root.node_count_end();
		
	},
	
	object_count_end: function () {
		
		return this.root.object_count_end();
		
	},
	
	to_console: function () {
		
		this.root.to_console();
		
	}
	
};

/*===================================================

object data

=====================================================*/

THREE.OctreeObjectData = function ( object, face ) {
	
	// utility
	
	this.utilVec31FaceBounds = new THREE.Vector3();
	
	// properties
	
	this.object = object;
	this.faces = face;
	
	this.radius = 0;
	this.position = new THREE.Vector3();
		
	// initial update
	
	if ( this.object instanceof THREE.Object3D ) {
		
		this.update();
		
	}
	
	this.positionLast = this.position.clone();
	
}

THREE.OctreeObjectData.prototype = {
	
	update: function () {
		
		if ( this.useFaces ) {
			
			this.radius = this.face_bounding_radius( this.object, this.faces );
			this.object.matrixWorld.multiplyVector3( this.position.copy( this.faces.centroid ) );
			
		}
		else {
			
			this.radius = this.object.geometry instanceof THREE.Geometry ? this.object.geometry.boundingSphere.radius : this.object.boundRadius;
			this.position.copy( this.object.matrixWorld.getPosition() );
			
		}
		
		this.radius = this.radius * Math.max( this.object.scale.x, this.object.scale.y, this.object.scale.z );
		
	},
	
	face_bounding_radius: function ( object, face ) {
		
		var geometry = object instanceof THREE.Mesh ? object.geometry : object,
			vertices = geometry.vertices,
			centroid = face.centroid,
			va = vertices[ face.a ], vb = vertices[ face.b ], vc = vertices[ face.c ], vd,
			centroidToVert = this.utilVec31FaceBounds,
			radius;
		
		// handle face type
		
		if ( face instanceof THREE.Face4 ) {
			
			vd = vertices[ face.d ];
			
			centroid.add( va, vb ).addSelf( vc ).addSelf( vd ).divideScalar( 4 );
			
			radius = Math.max( centroidToVert.sub( centroid, va ).length(), centroidToVert.sub( centroid, vb ).length(), centroidToVert.sub( centroid, vc ).length(), centroidToVert.sub( centroid, vd ).length() );
			
		}
		else {
			
			centroid.add( va, vb ).addSelf( vc ).divideScalar( 3 );
			
			radius = Math.max( centroidToVert.sub( centroid, va ).length(), centroidToVert.sub( centroid, vb ).length(), centroidToVert.sub( centroid, vc ).length() );
			
		}
		
		return radius;
		
	}
	
};

Object.defineProperty( THREE.OctreeObjectData.prototype, 'useFaces', { 
	get : function () { return this.faces instanceof THREE.Face3 || this.faces instanceof THREE.Face4; }
} );

/*===================================================

node

=====================================================*/

THREE.OctreeNode = function ( parameters ) {
	
	// utility
	
	this.utilVec31Branch = new THREE.Vector3();
	this.utilVec31Expand = new THREE.Vector3();
	this.utilVec31Search = new THREE.Vector3();
	this.utilVec31LinePoint = new THREE.Vector3();
	this.utilVec32LinePoint = new THREE.Vector3();
	this.utilVec33LinePoint = new THREE.Vector3();
	
	// handle parameters
	
	parameters = parameters || {};
	
	// store or create tree
	
	if ( parameters.tree instanceof THREE.Octree ) {
		
		this.tree = parameters.tree;
		
	}
	else if ( parent instanceof THREE.OctreeNode !== true ) {
		
		parameters.root = this;
		
		this.tree = new THREE.Octree( parameters );
		
	}
	
	// basic properties
	
	this.id = this.tree.nodeCount++;
	this.position = parameters.position instanceof THREE.Vector3 ? parameters.position : new THREE.Vector3();
	this.radius = this.is_number( parameters.radius ) && parameters.radius > 0 ? parameters.radius : 1;
	this.indexOctant = parameters.indexOctant;
	this.depth = 0;
	
	// reset and assign parent
	
	this.reset();
	this.parent = parameters.parent;
	
	// additional properties
	
	this.overlap = this.radius * this.tree.overlapPct;
	this.radiusOverlap = this.radius + this.overlap;
	this.left = this.position.x - this.radiusOverlap;
	this.right = this.position.x + this.radiusOverlap;
	this.bottom = this.position.y - this.radiusOverlap;
	this.top = this.position.y + this.radiusOverlap;
	this.back = this.position.z - this.radiusOverlap;
	this.front = this.position.z + this.radiusOverlap;
	
	// visual
	
	if ( this.tree.scene ) {
		
		this.visual = new THREE.Mesh( new THREE.CubeGeometry( this.radiusOverlap * 2, this.radiusOverlap * 2, this.radiusOverlap * 2 ), new THREE.MeshBasicMaterial( { color: 0xFF0000, wireframe: true, wireframeLinewidth: 10 } ) );
		this.visual.position.copy( this.position );
		this.tree.scene.add( this.visual );
		
	}
	
}

THREE.OctreeNode.prototype = {
	
	is_number: function ( n ) {
		return !isNaN( n ) && isFinite( n );
	},
	
	is_array: function ( target ) {
		return Object.prototype.toString.call( target ) === '[object Array]';
	},
	
	ensure_array: function ( target ) {
		
		return target ? ( this.is_array ( target ) !== true ? [ target ] : target ) : [];
		
	},
	
	properties_update_cascade: function () {
		
		var i, l;
		
		// properties
		
		if ( this._parent instanceof THREE.OctreeNode ) {
			
			this.tree = this._parent.tree;
			this.depth = this._parent.depth + 1;
			
		}
		else {
			
			this.depth = 0;
			
		}
		
		// cascade
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			this.nodesByIndex[ this.nodesIndices[ i ] ].properties_update_cascade();
			
		}
		
	},
	
	reset: function ( cascade, removeVisual ) {
		
		var i, l,
			node,
			nodesIndices = this.nodesIndices || [],
			nodesByIndex = this.nodesByIndex;
		
		this.objects = [];
		this.nodesIndices = [];
		this.nodesByIndex = {};
		
		// unset parent in nodes
		
		for ( i = 0, l = nodesIndices.length; i < l; i++ ) {
			
			node = nodesByIndex[ nodesIndices[ i ] ];
			
			node.parent = undefined;
			
			if ( cascade === true ) {
				
				node.reset( cascade, removeVisual );
				
			}
			
		}
		
		// visual
		
		if ( removeVisual === true && this.visual && this.visual.parent ) {
			
			this.visual.parent.remove( this.visual );
			
		}
		
	},
	
	add_node: function ( node, indexOctant ) {
		
		indexOctant = node.indexOctant = this.is_number( indexOctant ) ? indexOctant : this.is_number( node.indexOctant ) ? node.indexOctant : this.octant_index( node );
		
		if ( this.nodesIndices.indexOf( indexOctant ) === -1 ) {
			
			this.nodesIndices.push( indexOctant );
			
		}
		
		this.nodesByIndex[ indexOctant ] = node;
		
		if ( node.parent !== this ) {
			
			node.parent = this;
			
		}
		
	},
	
	remove_node: function ( identifier ) {
		
		var indexOctant = -1,
			index,
			node;
		
		// if identifier is node
		if ( identifier instanceof THREE.OctreeNode && this.nodesByIndex[ identifier.indexOctant ] === identifier ) {
			
			node = identifier;
			indexOctant = node.indexOctant;
			
		}
		// if identifier is number
		else if ( this.is_number( identifier ) ) {
			
			indexOctant = identifier;
			
		}
		// else search all nodes for identifier (slow)
		else {
			
			for ( index in this.nodesByIndex ) {
				
				node = this.nodesByIndex[ index ];
				
				if ( node === identifier ) {
					
					indexOctant = index;
					
					break;
					
				}
				
			}
			
		}
		
		// if indexOctant found
		
		if ( indexOctant !== -1 ) {
			
			index = this.nodesIndices.indexOf( indexOctant );
			
			this.nodesIndices.splice( index, 1 );
			
			node = node || this.nodesByIndex[ indexOctant ];
			
			delete this.nodesByIndex[ indexOctant ];
			
			if ( node.parent === this ) {
				
				node.parent = undefined;
				
			}
			
		}
		
	},
	
	add_object: function ( object ) {
		
		var index,
			node;
		
		// get object octant index
		
		indexOctant = this.octant_index( object );
		
		// if object fully contained by an octant, add to subtree
		if ( indexOctant > -1 && this.nodesIndices.length > 0 ) {
			
			node = this.branch( indexOctant );
			
			node.add_object( object );
			
		}
		// if object lies outside bounds, add to parent node
		else if ( indexOctant < -1 && this.parent instanceof THREE.OctreeNode ) {
			
			this.parent.add_object( object );
			
		}
		// else add to self
		else {
			
			// add to this objects list
			
			index = this.objects.indexOf( object );
			
			if ( index === -1 ) {
				
				this.objects.push( object );
				
			}
			
			// node reference
			
			object.node = this;
			
			// check if need to expand, split, or both
			
			this.grow_check();
			
		}
		
	},
	
	add_objects_no_check: function ( objects ) {
		
		var i, l,
			object;

		for ( i = 0, l = objects.length; i < l; i++ ) {
			
			object = objects[ i ];
			
			this.objects.push( object );
			
			object.node = this;
			
		}
		
	},
	
	remove_object: function ( object ) {
		
		var i, l,
			nodesRemovedFrom,
			removeData;
		
		// cascade through tree to find and remove object
		
		removeData = this.remove_object_end( object, { searchComplete: false, nodesRemovedFrom: [], objectsDataRemoved: [] } );
		
		// if object removed, try to shrink the nodes it was removed from
		
		nodesRemovedFrom = removeData.nodesRemovedFrom;
		
		if ( nodesRemovedFrom.length > 0 ) {
			
			for ( i = 0, l = nodesRemovedFrom.length; i < l; i++ ) {
				
				nodesRemovedFrom[ i ].shrink();
				
			}
			
		}
		
		return removeData.objectsDataRemoved;
		
	},
	
	remove_object_end: function ( object, removeData ) {
		
		var i, l,
			index = -1,
			objectData,
			node,
			objectRemoved;
		
		// find index of object in objects list
		
		// search and remove object data (fast)
		if ( object instanceof THREE.OctreeObjectData ) {
			
			// remove from this objects list
			
			index = this.objects.indexOf( object );
			
			if ( index !== -1 ) {
				
				this.objects.splice( index, 1 );
				object.node = undefined;
				
				removeData.objectsDataRemoved.push( object );
				
				removeData.searchComplete = objectRemoved = true;
				
			}
			
		}
		// search each object data for object and remove (slow)
		else {
			
			for ( i = this.objects.length - 1; i >= 0; i-- ) {
				
				objectData = this.objects[ i ];
				
				if ( objectData.object === object ) {
					
					this.objects.splice( i, 1 );
					objectData.node = undefined;
					
					removeData.objectsDataRemoved.push( objectData );
					
					objectRemoved = true;
					
					if ( typeof objectData.faces === 'undefined' ) {
						
						removeData.searchComplete = true;
						break;
						
					}
					
				}
				
			}
			
		}
		
		// if object data removed and this is not on nodes removed from
		
		if ( objectRemoved === true ) {//&& removeData.nodesRemovedFrom.indexOf( this ) === -1 ) {
			
			removeData.nodesRemovedFrom.push( this );
			
		}
		
		// if search not complete, search nodes
		
		if ( removeData.searchComplete !== true ) {
			
			for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
				
				node = this.nodesByIndex[ this.nodesIndices[ i ] ];
				
				// try removing object from node
				
				removeData = node.remove_object_end( object, removeData );
				
				if ( removeData.searchComplete === true ) {
					
					break;
					
				}
				
			}
			
		}
		
		return removeData;
		
	},
	
	grow_check: function () {
		
		// if object count above max
		
		if ( this.objects.length > this.tree.objectsThreshold && this.tree.objectsThreshold > 0 ) {
			
			this.grow();
			
		}
		
	},
	
	grow: function () {
		
		var objectsExpand = [],
			objectsExpandOctants = [],
			objectsSplit = [],
			objectsSplitOctants = [],
			objectsRemaining = [];
		
		// for each object
		
		for ( i = 0, l = this.objects.length; i < l; i++ ) {
			
			object = this.objects[ i ];
			
			// get object octant index
			
			indexOctant = this.octant_index( object );
			
			// if lies within octant
			if ( indexOctant > -1 ) {
				
				objectsSplit.push( object );
				objectsSplitOctants.push( indexOctant );
			
			}
			// if lies outside radius
			else if ( indexOctant < -1 ) {
				
				objectsExpand.push( object );
				objectsExpandOctants.push( indexOctant );
				
			}
			// else if lies across bounds between octants
			else {
				
				objectsRemaining.push( object );
				
			}
			
		}
		
		// if has objects to split
		
		if ( objectsSplit.length > 0) {
			
			objectsRemaining = objectsRemaining.concat( this.split( objectsSplit, objectsSplitOctants ) );
			
		}
		
		// if has objects to expand
		
		if ( objectsExpand.length > 0) {
			
			objectsRemaining = objectsRemaining.concat( this.expand( objectsExpand, objectsExpandOctants ) );
			
		}
		
		// store remaining
		
		this.objects = objectsRemaining;
		
		// merge check
		
		this.merge_check();
		
	},
	
	split: function ( objects, octants ) {
		
		var i, l,
			indexOctant,
			object,
			node,
			objectsRemaining;
		
		// if not at max depth
		
		if ( this.tree.depthMax < 0 || this.depth < this.tree.depthMax ) {
			
			objects = objects || this.objects;
			
			octants = octants || [];
			
			objectsRemaining = [];
			
			// for each object
			
			for ( i = 0, l = objects.length; i < l; i++ ) {
				
				object = objects[ i ];
				
				// get object octant index
				
				indexOctant = this.is_number( octants[ i ] ) ? octants[ i ] : this.octant_index( object );
				
				// if object contained by octant, branch this tree
				
				if ( indexOctant > -1 ) {
					
					node = this.branch( indexOctant );
					
					node.add_object( object );
					
				}
				// else add to remaining
				else {
					
					objectsRemaining.push( object );
					
				}
				
			}
			
			// if all objects, set remaining as new objects
			
			if ( objects === this.objects ) {
				
				this.objects = objectsRemaining;
				
			}
			
		}
		else {
			
			objectsRemaining = this.objects;
			
		}
		
		return objectsRemaining;
		
	},
	
	branch: function ( indexOctant ) {
		
		var node,
			overlap,
			radius,
			radiusOffset,
			offset,
			position;
		
		// node exists
		
		if ( this.nodesByIndex[ indexOctant ] instanceof THREE.OctreeNode ) {
			
			node = this.nodesByIndex[ indexOctant ];
			
		}
		// create new
		else {
			
			// properties
			
			radius = ( this.radiusOverlap ) * 0.5;
			overlap = radius * this.tree.overlapPct;
			radiusOffset = radius - overlap;
			offset = this.utilVec31Branch.set( indexOctant & 1 ? radiusOffset : -radiusOffset, indexOctant & 2 ? radiusOffset : -radiusOffset, indexOctant & 4 ? radiusOffset : -radiusOffset );
			position = new THREE.Vector3().add( this.position, offset );
			
			// node
			
			node = new THREE.OctreeNode( {
				tree: this.tree,
				parent: this,
				position: position,
				radius: radius,
				indexOctant: indexOctant
			} );
			
			// store
			
			this.add_node( node, indexOctant );
		
		}
		
		return node;
		
	},
	
	expand: function ( objects, octants ) {
		
		var i, l,
			object,
			objectsRemaining,
			objectsExpand,
			indexOctant,
			flagsOutside,
			indexOutside,
			indexOctantInverse,
			iom = this.tree.INDEX_OUTSIDE_MAP,
			indexOutsideCounts,
			infoIndexOutside1,
			infoIndexOutside2,
			infoIndexOutside3,
			indexOutsideBitwise1,
			indexOutsideBitwise2,
			infoPotential1,
			infoPotential2,
			infoPotential3,
			indexPotentialBitwise1,
			indexPotentialBitwise2,
			octantX, octantY, octantZ,
			overlap,
			radius,
			radiusOffset,
			radiusParent,
			overlapParent,
			offset = this.utilVec31Expand,
			position,
			parent;
		
		// handle max depth down tree
		
		if ( this.tree.depthMax < 0 || this.tree.root.depth_end() < this.tree.depthMax ) {
			
			objects = objects || this.objects;
			octants = octants || [];
			
			objectsRemaining = [];
			objectsExpand = [];
			
			// reset counts
			
			for ( i = 0, l = iom.length; i < l; i++ ) {
				
				iom[ i ].count = 0;
				
			}
			
			// for all outside objects, find outside octants containing most objects
			
			for ( i = 0, l = objects.length; i < l; i++ ) {
				
				object = objects[ i ];
				
				// get object octant index
				
				indexOctant = this.is_number( octants[ i ] ) ? octants[ i ] : this.octant_index( object );
				
				// if object outside this, include in calculations
				
				if ( indexOctant < -1 ) {
					
					// convert octant index to outside flags
					
					flagsOutside = -indexOctant - this.tree.INDEX_OUTSIDE_OFFSET;
					
					// check against bitwise flags
					
					// x
					
					if ( flagsOutside & this.tree.FLAG_POS_X ) {
						
						iom[ this.tree.INDEX_OUTSIDE_POS_X ].count++;
						
					}
					else if ( flagsOutside & this.tree.FLAG_NEG_X ) {
						
						iom[ this.tree.INDEX_OUTSIDE_NEG_X ].count++;
						
					}
					
					// y
					
					if ( flagsOutside & this.tree.FLAG_POS_Y ) {
						
						iom[ this.tree.INDEX_OUTSIDE_POS_Y ].count++;
						
					}
					else if ( flagsOutside & this.tree.FLAG_NEG_Y ) {
						
						iom[ this.tree.INDEX_OUTSIDE_NEG_Y ].count++;
						
					}
					
					// z
					
					if ( flagsOutside & this.tree.FLAG_POS_Z ) {
						
						iom[ this.tree.INDEX_OUTSIDE_POS_Z ].count++;
						
					}
					else if ( flagsOutside & this.tree.FLAG_NEG_Z ) {
						
						iom[ this.tree.INDEX_OUTSIDE_NEG_Z ].count++;
						
					}
					
					// store in expand list
					
					objectsExpand.push( object );
					
				}
				// else add to remaining
				else {
					
					objectsRemaining.push( object );
					
				}
				
			}
			
			// if objects to expand
			
			if ( objectsExpand.length > 0 ) {
				
				// shallow copy index outside map
				
				indexOutsideCounts = iom.slice( 0 );
				
				// sort outside index count so highest is first
				
				indexOutsideCounts.sort( function ( a, b ) {
					
					return b.count - a.count;
					
				} );
				
				// get highest outside indices
				
				// first is first
				infoIndexOutside1 = indexOutsideCounts[ 0 ];
				indexOutsideBitwise1 = infoIndexOutside1.index | 1;
				
				// second is ( one of next two bitwise OR 1 ) that is not opposite of ( first bitwise OR 1 )
				
				infoPotential1 = indexOutsideCounts[ 1 ];
				infoPotential2 = indexOutsideCounts[ 2 ];
				
				infoIndexOutside2 = ( infoPotential1.index | 1 ) !== indexOutsideBitwise1 ? infoPotential1 : infoPotential2;
				indexOutsideBitwise2 = infoIndexOutside2.index | 1;
				
				// third is ( one of next three bitwise OR 1 ) that is not opposite of ( first or second bitwise OR 1 )
				
				infoPotential1 = indexOutsideCounts[ 2 ];
				infoPotential2 = indexOutsideCounts[ 3 ];
				infoPotential3 = indexOutsideCounts[ 4 ];
				
				indexPotentialBitwise1 = infoPotential1.index | 1;
				indexPotentialBitwise2 = infoPotential2.index | 1;
				
				infoIndexOutside3 = indexPotentialBitwise1 !== indexOutsideBitwise1 && indexPotentialBitwise1 !== indexOutsideBitwise2 ? infoPotential1 : indexPotentialBitwise2 !== indexOutsideBitwise1 && indexPotentialBitwise2 !== indexOutsideBitwise2 ? infoPotential2 : infoPotential3;
				
				// get this octant normal based on outside octant indices
				
				octantX = infoIndexOutside1.x + infoIndexOutside2.x + infoIndexOutside3.x;
				octantY = infoIndexOutside1.y + infoIndexOutside2.y + infoIndexOutside3.y;
				octantZ = infoIndexOutside1.z + infoIndexOutside2.z + infoIndexOutside3.z;
				
				// get this octant indices based on octant normal
				
				indexOctant = this.octant_index_from_xyz( octantX, octantY, octantZ );
				indexOctantInverse = this.octant_index_from_xyz( -octantX, -octantY, -octantZ );
				
				// properties
				
				overlap = this.overlap;
				radius = this.radius;
				
				// radius of parent comes from reversing overlap of this, unless overlap percent is 0
				
				radiusParent = this.tree.overlapPct > 0 ? overlap / ( ( 0.5 * this.tree.overlapPct ) * ( 1 + this.tree.overlapPct ) ) : radius * 2; 
				overlapParent = radiusParent * this.tree.overlapPct;
				
				// parent offset is difference between radius + overlap of parent and child
				
				radiusOffset = ( radiusParent + overlapParent ) - ( radius + overlap );
				offset.set( indexOctant & 1 ? radiusOffset : -radiusOffset, indexOctant & 2 ? radiusOffset : -radiusOffset, indexOctant & 4 ? radiusOffset : -radiusOffset );
				position = new THREE.Vector3().add( this.position, offset );
				
				// parent
				
				parent = new THREE.OctreeNode( {
					tree: this.tree,
					position: position,
					radius: radiusParent
				} );
				
				// set self as node of parent
				
				parent.add_node( this, indexOctantInverse );
				
				// set parent as root
				
				this.tree.root_set( parent );
				
				// add all expand objects to parent
				
				for ( i = 0, l = objectsExpand.length; i < l; i++ ) {
					
					this.tree.root.add_object( objectsExpand[ i ] );
					
				}
				
			}
			
			// if all objects, set remaining as new objects
			
			if ( objects === this.objects ) {
				
				this.objects = objectsRemaining;
				
			}
			
		}
		else {
			
			objectsRemaining = objects;
			
		}
		
		return objectsRemaining;
		
	},
	
	shrink: function () {
		
		// merge check
		
		this.merge_check();
		
		// contract check
		
		this.tree.root.contract_check();
		
	},
	
	merge_check: function () {
		
		var nodeParent = this,
			nodeMerge;
		
		// traverse up tree as long as node + entire subtree's object count is under minimum
		
		while ( nodeParent.parent instanceof THREE.OctreeNode && nodeParent.object_count_end() < this.tree.objectsThreshold ) {
			
			nodeMerge = nodeParent;
			nodeParent = nodeParent.parent;
			
		}
		
		// if parent node is not this, merge entire subtree into merge node
		
		if ( nodeParent !== this ) {
			
			nodeParent.merge( nodeMerge );
			
		}
		
	},
	
	merge: function ( nodes ) {
		
		var i, l,
			j, k,
			node;
		
		// handle nodes
		
		nodes = this.ensure_array( nodes );
		
		for ( i = 0, l = nodes.length; i < l; i++ ) {
			
			node = nodes[ i ];
			
			// gather node + all subtree objects
			
			this.add_objects_no_check( node.objects_end() );
			
			// reset node + entire subtree
			
			node.reset( true, true );
			
			// remove node
			
			this.remove_node( node.indexOctant, node );
			
		}
		
		// merge check
		
		this.merge_check();
		
	},
	
	contract_check: function () {
		
		var i, l,
			node,
			nodeObjectsCount,
			nodeHeaviest,
			nodeHeaviestObjectsCount,
			outsideHeaviestObjectsCount;
		
		// find node with highest object count
		
		if ( this.nodesIndices.length > 0 ) {
			
			nodeHeaviestObjectsCount = 0;
			outsideHeaviestObjectsCount = this.objects.length;
			
			for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
				
				node = this.nodesByIndex[ this.nodesIndices[ i ] ];
				
				nodeObjectsCount = node.object_count_end();
				outsideHeaviestObjectsCount += nodeObjectsCount;
				
				if ( nodeHeaviest instanceof THREE.OctreeNode === false || nodeObjectsCount > nodeHeaviestObjectsCount ) {
					
					nodeHeaviest = node;
					nodeHeaviestObjectsCount = nodeObjectsCount;
					
				}
				
			}
			
			// subtract heaviest count from outside count
			
			outsideHeaviestObjectsCount -= nodeHeaviestObjectsCount;
			
			// if should contract
			
			if ( outsideHeaviestObjectsCount < this.tree.objectsThreshold && nodeHeaviest instanceof THREE.OctreeNode ) {
				
				this.contract( nodeHeaviest );
				
			}
			
		}
		
	},
	
	contract: function ( nodeRoot ) {
		
		var i, l,
			node;
		
		// handle all nodes
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			node = this.nodesByIndex[ this.nodesIndices[ i ] ];
			
			// if node is not new root
			
			if ( node !== nodeRoot ) {
				
				// add node + all subtree objects to root
				
				nodeRoot.add_objects_no_check( node.objects_end() );
				
				// reset node + entire subtree
				
				node.reset( true, true );
				
			}
			
		}
		
		// add own objects to root
		
		nodeRoot.add_objects_no_check( this.objects );
		
		// reset self
		
		this.reset( false, true );
		
		// set new root
		
		this.tree.root_set( nodeRoot );
		
		// contract check on new root
		
		nodeRoot.contract_check();
		
	},
	
	octant_index: function ( objectData ) {
		
		var i, l,
			positionObj,
			radiusObj,
			position = this.position,
			radiusOverlap = this.radiusOverlap,
			overlap = this.overlap,
			deltaX, deltaY, deltaZ,
			distX, distY, distZ, 
			distance,
			indexOctant = 0;
		
		// handle type
		
		// object data
		if ( objectData instanceof THREE.OctreeObjectData ) {
			
			radiusObj = objectData.radius;
			
			positionObj = objectData.position;
			
			// update object data position last
			
			objectData.positionLast.copy( positionObj );
			
		}
		// node
		else if ( objectData instanceof THREE.OctreeNode ) {
			
			positionObj = objectData.position;
			
			radiusObj = 0;
			
		}
		
		// find delta and distance
		
		deltaX = positionObj.x - position.x;
		deltaY = positionObj.y - position.y;
		deltaZ = positionObj.z - position.z;
		
		distX = Math.abs( deltaX );
		distY = Math.abs( deltaY );
		distZ = Math.abs( deltaZ );
		distance = Math.max( distX, distY, distZ );
		
		// if outside, use bitwise flags to indicate on which sides object is outside of
		
		if ( distance + radiusObj > radiusOverlap ) {
			
			// x
			
			if ( distX + radiusObj > radiusOverlap ) {
				
				indexOctant = indexOctant ^ ( deltaX > 0 ? this.tree.FLAG_POS_X : this.tree.FLAG_NEG_X );
				
			}
			
			// y
			
			if ( distY + radiusObj > radiusOverlap ) {
				
				indexOctant = indexOctant ^ ( deltaY > 0 ? this.tree.FLAG_POS_Y : this.tree.FLAG_NEG_Y );
				
			}
			
			// z
			
			if ( distZ + radiusObj > radiusOverlap ) {
				
				indexOctant = indexOctant ^ ( deltaZ > 0 ? this.tree.FLAG_POS_Z : this.tree.FLAG_NEG_Z );
				
			}
			
			objectData.indexOctant = -indexOctant - this.tree.INDEX_OUTSIDE_OFFSET;
			
			return objectData.indexOctant;
			
		}
		
		// return octant index from delta xyz
		
		// x right
		if ( deltaX - radiusObj > -overlap ) {
			
			indexOctant = indexOctant | 1;
			
		}
		// x left
		else if ( !( deltaX + radiusObj < overlap ) ) {
			
			objectData.indexOctant = this.tree.INDEX_INSIDE_CROSS;
			return objectData.indexOctant;
			
		}
		
		// y right
		if ( deltaY - radiusObj > -overlap ) {
			
			indexOctant = indexOctant | 2;
			
		}
		// y left
		else if ( !( deltaY + radiusObj < overlap ) ) {
			
			objectData.indexOctant = this.tree.INDEX_INSIDE_CROSS;
			return objectData.indexOctant;
			
		}
		
		// z right
		if ( deltaZ - radiusObj > -overlap ) {
			
			indexOctant = indexOctant | 4;
			
		}
		// z left
		else if ( !( deltaZ + radiusObj < overlap ) ) {
			
			objectData.indexOctant = this.tree.INDEX_INSIDE_CROSS;
			return objectData.indexOctant;
			
		}
		
		objectData.indexOctant = indexOctant;
		return objectData.indexOctant;
		
	},
	
	octant_index_from_xyz: function ( x, y, z ) {
		
		var indexOctant = 0;
		
		if ( x > 0 ) {
			
			indexOctant = indexOctant | 1;
			
		}
		
		if ( y > 0 ) {
			
			indexOctant = indexOctant | 2;
			
		}
		
		if ( z > 0 ) {
			
			indexOctant = indexOctant | 4;
			
		}
		
		return indexOctant;
		
	},
	
	search: function ( position, radius, objects, direction ) {
		
		var i, l,
			node,
			intersects;
		
		// test intersects by parameters
		
		if ( direction ) {
			
			intersects = this.intersect_ray( position, direction, radius );
			
		}
		else {
			
			intersects = this.intersect_sphere( position, radius );
			
		}
		
		// if intersects
		
		if ( intersects === true ) {
			
			// gather objects
			
			objects = objects.concat( this.objects );
			
			// search subtree
			
			for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
				
				node = this.nodesByIndex[ this.nodesIndices[ i ] ];
				
				objects = node.search( position, radius, objects, direction );
				
			}
			
		}
		
		return objects;
		
	},
	
	intersect_sphere: function ( position, radius ) {
		
		var	distance = radius * radius,
			sx = position.x,
			sy = position.y,
			sz = position.z;
		
		if ( sx < this.left ) {
			distance -= Math.pow( sx - this.left, 2 );
		}
		else if ( sx > this.right ) {
			distance -= Math.pow( sx - this.right, 2 );
		}
		
		if ( sy < this.bottom ) {
			distance -= Math.pow( sy - this.bottom, 2 );
		}
		else if ( sy > this.top ) {
			distance -= Math.pow( sy - this.top, 2 );
		}
		
		if ( sz < this.back ) {
			distance -= Math.pow( sz - this.back, 2 );
		}
		else if ( sz > this.front ) {
			distance -= Math.pow( sz - this.front, 2 );
		}
		
		return distance >= 0;
		
	},

	intersect_ray: function ( position, direction, distance ) {
		
		// ray intersects if this intersects a 0 radius sphere at closest point to this position along ray
		
		return this.intersect_sphere( this.closest_point_from_line( position, direction, distance ), 0 );
		
	},
	
	closest_point_from_line: function ( origin, direction, length ) {
		
		var dot,
			dotClamped,
			originToPoint = this.utilVec31LinePoint.sub( this.position, origin ),
			directionMagnitude = this.utilVec32LinePoint.copy( direction ).normalize(),
			pointClosest = this.utilVec33LinePoint;
		
		dot = originToPoint.dot( direction );
		
		// if line segment
		
		if( this.is_number( length ) && length > 0 ) {
			
			dotClamped = Math.min( Math.max( dot / length, 0 ), 1 );
			
		}
		// else infinite ray
		else {
			
			length = 1;
			dotClamped = Math.max( 0, dot );
			
		}
		
		pointClosest.add( origin, directionMagnitude.multiplyScalar( dotClamped * length ) );
		
		return pointClosest;
		
	},
	
	depth_end: function ( depth ) {
		
		var i, l,
			node;

		if ( this.nodesIndices.length > 0 ) {
			
			for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {

				node = this.nodesByIndex[ this.nodesIndices[ i ] ];

				depth = node.depth_end( depth );

			}
			
		}
		else {

			depth = !depth || this.depth > depth ? this.depth : depth;

		}

		return depth;
		
	},
	
	node_count_end: function () {
		
		return this.tree.root.node_count_cascade() + 1;
		
	},
	
	node_count_cascade: function () {
		
		var i, l,
			count = this.nodesIndices.length;
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			count += this.nodesByIndex[ this.nodesIndices[ i ] ].node_count_cascade();
			
		}
		
		return count;
		
	},
	
	objects_end: function ( objects ) {
		
		var i, l,
			node;
		
		objects = ( objects || [] ).concat( this.objects );
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			node = this.nodesByIndex[ this.nodesIndices[ i ] ];
			
			objects = node.objects_end( objects );
			
		}
		
		return objects;
		
	},
	
	object_count_end: function () {
		
		var i, l,
			count = this.objects.length;
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			count += this.nodesByIndex[ this.nodesIndices[ i ] ].object_count_end();
			
		}
		
		return count;
		
	},
	
	object_count_start: function () {
		
		var count = this.objects.length,
			parent = this.parent;
		
		while( parent instanceof THREE.OctreeNode ) {
			
			count += parent.objects.length;
			parent = parent.parent;
			
		}
		
		return count;
		
	},
	
	to_console: function ( space ) {
		
		var i, l,
			node,
			spaceAddition = '   ';
		
		space = typeof space === 'string' ? space : spaceAddition;
		
		console.log( ( this.parent ? space + ' octree NODE > ' : ' octree ROOT > ' ), this, ' // id: ', this.id, ' // indexOctant: ', this.indexOctant, ' // position: ', this.position.x, this.position.y, this.position.z, ' // radius: ', this.radius, ' // depth: ', this.depth );
		console.log( ( this.parent ? space + ' ' : ' ' ), '+ objects ( ', this.objects.length, ' ) ', this.objects );
		console.log( ( this.parent ? space + ' ' : ' ' ), '+ children ( ', this.nodesIndices.length, ' )', this.nodesIndices, this.nodesByIndex );
		
		for ( i = 0, l = this.nodesIndices.length; i < l; i++ ) {
			
			node = this.nodesByIndex[ this.nodesIndices[ i ] ];
			
			node.to_console( space + spaceAddition );
			
		}
		
	}
	
};

Object.defineProperty( THREE.OctreeNode.prototype, 'parent', { 
	get : function () { return this._parent; },
	set : function ( parent ) {
		
		// store new parent
		
		if ( parent !== this ) {
			
			this._parent = parent;
			
		}
		
		// update properties
		
		this.properties_update_cascade();
		
	}
	
} );