/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module engine/controller/editingcontroller
 */

import RootEditableElement from '../view/rooteditableelement';
import View from '../view/view';
import Mapper from '../conversion/mapper';
import DowncastDispatcher from '../conversion/downcastdispatcher';
import { clearAttributes, convertCollapsedSelection, convertRangeSelection, insertText, remove } from '../conversion/downcasthelpers';

import ObservableMixin from '@ckeditor/ckeditor5-utils/src/observablemixin';
import mix from '@ckeditor/ckeditor5-utils/src/mix';
import { convertSelectionChange } from '../conversion/upcasthelpers';

/**
 * Controller for the editing pipeline. The editing pipeline controls {@link ~EditingController#model model} rendering,
 * including selection handling. It also creates the {@link ~EditingController#view view} which builds a
 * browser-independent virtualization over the DOM elements. The editing controller also attaches default converters.
 *
 * @mixes module:utils/observablemixin~ObservableMixin
 */
export default class EditingController {
	/**
	 * Creates an editing controller instance.
	 *
	 * @param {module:engine/model/model~Model} model Editing model.
	 */
	constructor( model ) {
		/**
		 * Editor model.
		 *
		 * @readonly
		 * @member {module:engine/model/model~Model}
		 */
		this.model = model;

		/**
		 * Editing view controller.
		 *
		 * @readonly
		 * @member {module:engine/view/view~View}
		 */
		this.view = new View();

		/**
		 * Mapper which describes the model-view binding.
		 *
		 * @readonly
		 * @member {module:engine/conversion/mapper~Mapper}
		 */
		this.mapper = new Mapper();

		/**
		 * Downcast dispatcher that converts changes from the model to {@link #view the editing view}.
		 *
		 * @readonly
		 * @member {module:engine/conversion/downcastdispatcher~DowncastDispatcher} #downcastDispatcher
		 */
		this.downcastDispatcher = new DowncastDispatcher( {
			mapper: this.mapper
		} );

		const doc = this.model.document;
		const selection = doc.selection;
		const markers = this.model.markers;

		// When plugins listen on model changes (on selection change, post fixers, etc) and change the view as a result of
		// model's change, they might trigger view rendering before the conversion is completed (e.g. before the selection
		// is converted). We disable rendering for the length of the outermost model change() block to prevent that.
		//
		// See  https://github.com/ckeditor/ckeditor5-engine/issues/1528
		this.listenTo( this.model, '_beforeChanges', () => {
			this.view._renderingDisabled = true;
		}, { priority: 'highest' } );

		this.listenTo( this.model, '_afterChanges', () => {
			this.view._renderingDisabled = false;
			this.view.render();
		}, { priority: 'lowest' } );

		// Whenever model document is changed, convert those changes to the view (using model.Document#differ).
		// Do it on 'low' priority, so changes are converted after other listeners did their job.
		// Also convert model selection.
		this.listenTo( doc, 'change', () => {
			this.view.change( writer => {
				this.downcastDispatcher.convertChanges( doc.differ, writer );
				this.downcastDispatcher.convertSelection( selection, markers, writer );
			} );
		}, { priority: 'low' } );

		// Convert selection from the view to the model when it changes in the view.
		this.listenTo( this.view.document, 'selectionChange', convertSelectionChange( this.model, this.mapper ) );

		// Attach default model converters.
		this.downcastDispatcher.on( 'insert:$text', insertText(), { priority: 'lowest' } );
		this.downcastDispatcher.on( 'remove', remove(), { priority: 'low' } );

		// Attach default model selection converters.
		this.downcastDispatcher.on( 'selection', clearAttributes(), { priority: 'low' } );
		this.downcastDispatcher.on( 'selection', convertRangeSelection(), { priority: 'low' } );
		this.downcastDispatcher.on( 'selection', convertCollapsedSelection(), { priority: 'low' } );

		// Binds {@link module:engine/view/document~Document#roots view roots collection} to
		// {@link module:engine/model/document~Document#roots model roots collection} so creating
		// model root automatically creates corresponding view root.
		this.view.document.roots.bindTo( this.model.document.roots ).using( root => {
			// $graveyard is a special root that has no reflection in the view.
			if ( root.rootName == '$graveyard' ) {
				return null;
			}

			const viewRoot = new RootEditableElement( root.name );

			viewRoot.rootName = root.rootName;
			viewRoot._document = this.view.document;
			this.mapper.bindElements( root, viewRoot );

			return viewRoot;
		} );
	}

	/**
	 * Removes all event listeners attached to the `EditingController`. Destroys all objects created
	 * by `EditingController` that need to be destroyed.
	 */
	destroy() {
		this.view.destroy();
		this.stopListening();
	}
}

mix( EditingController, ObservableMixin );
