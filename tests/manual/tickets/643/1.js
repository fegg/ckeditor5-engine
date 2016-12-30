/**
 * @license Copyright (c) 2003-2016, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/* globals console, window, document */

import ClassicEditor from 'ckeditor5-editor-classic/src/classic';
import Enter from 'ckeditor5-enter/src/enter';
import Typing from 'ckeditor5-typing/src/typing';
import Paragraph from 'ckeditor5-paragraph/src/paragraph';
import Bold from 'ckeditor5-basic-styles/src/bold';
import Italic from 'ckeditor5-basic-styles/src/italic';
import List from 'ckeditor5-list/src/list';
import Heading from 'ckeditor5-heading/src/heading';
import Undo from 'ckeditor5-undo/src/undo';

import buildModelConverter from 'ckeditor5-engine/src/conversion/buildmodelconverter';
import Position from 'ckeditor5-engine/src/model/position';
import LiveRange from 'ckeditor5-engine/src/model/liverange';
import ViewAttributeElement from 'ckeditor5-engine/src/view/attributeelement';

let model = null;

ClassicEditor.create( document.querySelector( '#editor' ), {
	plugins: [ Enter, Typing, Paragraph, Bold, Italic, List, Heading, Undo ],
	toolbar: [ 'headings', 'bold', 'italic', 'bulletedList', 'numberedList', 'undo', 'redo' ]
} )
.then( editor => {
	window.editor = editor;
	model = window.editor.editing.model;

	buildModelConverter().for( editor.editing.modelToView ).
		fromMarker( 'highlight' ).
		toElement( ( data ) => {
			const color = data.name.split( ':' )[ 1 ];

			return new ViewAttributeElement( 'span', { class: 'h-' + color } );
		} );

	window.document.getElementById( 'add-yellow' ).addEventListener( 'click', () => addHighlight( 'yellow' ) );
	window.document.getElementById( 'add-red' ).addEventListener( 'click', () => addHighlight( 'red' ) );
	window.document.getElementById( 'remove-marker' ).addEventListener( 'click', () => removeHighlight() );
	window.document.getElementById( 'move-to-start' ).addEventListener( 'click', () => moveSelectionToStart() );
	window.document.getElementById( 'move-left' ).addEventListener( 'click', () => moveSelectionByOffset( -1 ) );
	window.document.getElementById( 'move-right' ).addEventListener( 'click', () => moveSelectionByOffset( 1 ) );

	model.enqueueChanges( () => {
		const root = model.getRoot();
		const range = new LiveRange( new Position( root, [ 0, 10 ] ), new Position( root, [ 0, 16 ] ) );
		const name = 'highlight:yellow:' + uid();

		markerNames.push( name );
		model.markers.add( name, range );
	} );
} )
.catch( err => {
	console.error( err.stack );
} );

const markerNames = [];
let _uid = 1;

function uid() {
	return _uid++;
}

function addHighlight( color ) {
	model.enqueueChanges( () => {
		const range = LiveRange.createFromRange( model.selection.getFirstRange() );
		const name = 'highlight:' + color + ':' + uid();

		markerNames.push( name );
		model.markers.add( name, range );
	} );
}

function removeHighlight() {
	model.enqueueChanges( () => {
		const pos = model.selection.getFirstPosition();

		for ( let i = 0; i < markerNames.length; i++ ) {
			const name = markerNames[ i ];
			const range = model.markers.get( name );

			if ( range.containsPosition( pos ) || range.start.isEqual( pos ) || range.end.isEqual( pos ) ) {
				model.markers.remove( name );
				range.detach();

				markerNames.splice( i, 1 );
				break;
			}
		}
	} );
}

function moveSelectionToStart() {
	const range = model.selection.getFirstRange();

	if ( range.isFlat ) {
		model.enqueueChanges( () => {
			model.batch().move( range, new Position( model.getRoot(), [ 0, 0 ] ) );
		} );
	}
}

function moveSelectionByOffset( offset ) {
	const range = model.selection.getFirstRange();
	const pos = offset < 0 ? range.start : range.end;

	if ( range.isFlat ) {
		model.enqueueChanges( () => {
			model.batch().move( range, pos.getShiftedBy( offset ) );
		} );
	}
}