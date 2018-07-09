/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import EditingController from '../../src/controller/editingcontroller';

import Model from '../../src/model/model';
import ModelText from '../../src/model/text';
import ModelRange from '../../src/model/range';

import MarkerOperation from '../../src/model/operation/markeroperation';

describe( 'Bug ckeditor5-engine@1323', () => {
	describe( 'constructor()', () => {
		let model, editing, root, range;

		beforeEach( () => {
			model = new Model();
			editing = new EditingController( model );
			root = model.document.createRoot();
			root._appendChild( new ModelText( 'foo' ) );
			range = ModelRange.createFromParentsAndOffsets( root, 0, root, 0 );
		} );

		afterEach( () => {
			editing.destroy();
		} );

		it( 'should not fire view#render event before initial model#change block is finished', () => {
			const spy = sinon.spy();

			editing.view.on( 'render', spy );

			model.change( () => {
				// Add marker.
				model.applyOperation( new MarkerOperation( 'name', null, range, model.markers, 0 ) );

				// Remove marker.
				model.applyOperation( new MarkerOperation( 'name', range, null, model.markers, 1 ) );

				sinon.assert.notCalled( spy );
			} );
		} );
	} );
} );
