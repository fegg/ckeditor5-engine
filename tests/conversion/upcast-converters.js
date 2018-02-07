/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Conversion from '../../src/conversion/conversion';
import UpcastDispatcher from '../../src/conversion/upcastdispatcher';

import ViewContainerElement from '../../src/view/containerelement';
import ViewDocumentFragment from '../../src/view/documentfragment';
import ViewText from '../../src/view/text';
import ViewUIElement from '../../src/view/uielement';
import ViewAttributeElement from '../../src/view/attributeelement';

import Model from '../../src/model/model';
import ModelDocumentFragment from '../../src/model/documentfragment';
import ModelElement from '../../src/model/element';
import ModelText from '../../src/model/text';
import ModelRange from '../../src/model/range';
import ModelPosition from '../../src/model/position';

import {
	upcastElementToElement, upcastElementToAttribute, upcastAttributeToAttribute, upcastElementToMarker,
	convertToModelFragment, convertText
} from '../../src/conversion/upcast-converters';

import { stringify } from '../../src/dev-utils/model';

describe( 'upcast-helpers', () => {
	let dispatcher, model, schema, conversion;

	beforeEach( () => {
		model = new Model();

		schema = model.schema;

		schema.extend( '$text', {
			allowIn: '$root'
		} );

		schema.register( '$marker', {
			inheritAllFrom: '$block'
		} );

		schema.register( 'paragraph', {
			inheritAllFrom: '$block'
		} );

		schema.extend( '$text', {
			allowAttributes: [ 'bold' ]
		} );

		dispatcher = new UpcastDispatcher( model, { schema } );
		dispatcher.on( 'text', convertText() );
		dispatcher.on( 'element', convertToModelFragment(), { priority: 'lowest' } );
		dispatcher.on( 'documentFragment', convertToModelFragment(), { priority: 'lowest' } );

		conversion = new Conversion();
		conversion.register( 'upcast', [ dispatcher ] );
	} );

	describe( 'upcastElementToElement', () => {
		it( 'config.view is a string', () => {
			const helper = upcastElementToElement( { view: 'p', model: 'paragraph' } );

			conversion.for( 'upcast' ).add( helper );

			expectResult( new ViewContainerElement( 'p' ), '<paragraph></paragraph>' );
		} );

		it( 'can be overwritten using priority', () => {
			schema.register( 'p', {
				inheritAllFrom: '$block'
			} );

			const helperA = upcastElementToElement( { view: 'p', model: 'p' } );
			const helperB = upcastElementToElement( { view: 'p', model: 'paragraph' }, 'high' );

			conversion.for( 'upcast' ).add( helperA ).add( helperB );

			expectResult( new ViewContainerElement( 'p' ), '<paragraph></paragraph>' );
		} );

		it( 'config.view is an object', () => {
			schema.register( 'fancyParagraph', {
				inheritAllFrom: '$block'
			} );

			const helperParagraph = upcastElementToElement( { view: 'p', model: 'paragraph' } );
			const helperFancy = upcastElementToElement( {
				view: {
					name: 'p',
					class: 'fancy'
				},
				model: 'fancyParagraph'
			}, 'high' );

			conversion.for( 'upcast' ).add( helperParagraph ).add( helperFancy );

			expectResult( new ViewContainerElement( 'p' ), '<paragraph></paragraph>' );
			expectResult( new ViewContainerElement( 'p', { class: 'fancy' } ), '<fancyParagraph></fancyParagraph>' );
		} );

		it( 'config.model is element instance', () => {
			schema.extend( 'paragraph', {
				allowAttributes: [ 'fancy' ]
			} );

			const helper = upcastElementToElement( {
				view: {
					name: 'p',
					class: 'fancy'
				},
				model: new ModelElement( 'paragraph', { fancy: true } )
			} );

			conversion.for( 'upcast' ).add( helper );

			expectResult( new ViewContainerElement( 'p', { class: 'fancy' } ), '<paragraph fancy="true"></paragraph>' );
		} );

		it( 'config.model is a function', () => {
			schema.register( 'heading', {
				inheritAllFrom: '$block',
				allowAttributes: [ 'level' ]
			} );

			const helper = upcastElementToElement( {
				view: {
					name: 'p',
					class: 'heading'
				},
				model: viewElement => new ModelElement( 'heading', { level: viewElement.getAttribute( 'data-level' ) } )
			} );

			conversion.for( 'upcast' ).add( helper );

			expectResult( new ViewContainerElement( 'p', { class: 'heading', 'data-level': 2 } ), '<heading level="2"></heading>' );
		} );

		it( 'should fire conversion of the element children', () => {
			const helper = upcastElementToElement( { view: 'p', model: 'paragraph' } );

			conversion.for( 'upcast' ).add( helper );

			expectResult( new ViewContainerElement( 'p', null, new ViewText( 'foo' ) ), '<paragraph>foo</paragraph>' );
		} );

		it( 'should not insert a model element if it is not allowed by schema', () => {
			const helper = upcastElementToElement( { view: 'h2', model: 'heading' } );

			conversion.for( 'upcast' ).add( helper );

			expectResult( new ViewContainerElement( 'h2' ), '' );
		} );

		it( 'should auto-break elements', () => {
			schema.register( 'heading', {
				inheritAllFrom: '$block'
			} );

			const helperParagraph = upcastElementToElement( { view: 'p', model: 'paragraph' } );
			const helperHeading = upcastElementToElement( { view: 'h2', model: 'heading' } );

			conversion.for( 'upcast' ).add( helperParagraph ).add( helperHeading );

			expectResult(
				new ViewContainerElement( 'p', null, [
					new ViewText( 'Foo' ),
					new ViewContainerElement( 'h2', null, new ViewText( 'Xyz' ) ),
					new ViewText( 'Bar' )
				] ),
				'<paragraph>Foo</paragraph><heading>Xyz</heading><paragraph>Bar</paragraph>'
			);
		} );

		it( 'should not do anything if returned model element is null', () => {
			const helperA = upcastElementToElement( { view: 'p', model: 'paragraph' } );
			const helperB = upcastElementToElement( { view: 'p', model: () => null }, 'high' );

			conversion.for( 'upcast' ).add( helperA ).add( helperB );

			expectResult( new ViewContainerElement( 'p' ), '<paragraph></paragraph>' );
		} );
	} );

	describe( 'upcastElementToAttribute', () => {
		it( 'config.view is string', () => {
			const helper = upcastElementToAttribute( { view: 'strong', model: 'bold' } );

			conversion.for( 'upcast' ).add( helper );

			expectResult(
				new ViewAttributeElement( 'strong', null, new ViewText( 'foo' ) ),
				'<$text bold="true">foo</$text>'
			);
		} );

		it( 'can be overwritten using priority', () => {
			const helperA = upcastElementToAttribute( { view: 'strong', model: 'strong' } );
			const helperB = upcastElementToAttribute( { view: 'strong', model: 'bold' }, 'high' );

			conversion.for( 'upcast' ).add( helperA ).add( helperB );

			expectResult(
				new ViewAttributeElement( 'strong', null, new ViewText( 'foo' ) ),
				'<$text bold="true">foo</$text>'
			);
		} );

		it( 'config.view is an object', () => {
			const helper = upcastElementToAttribute( {
				view: {
					name: 'span',
					class: 'bold'
				},
				model: 'bold'
			} );

			conversion.for( 'upcast' ).add( helper );

			expectResult(
				new ViewAttributeElement( 'span', { class: 'bold' }, new ViewText( 'foo' ) ),
				'<$text bold="true">foo</$text>'
			);
		} );

		it( 'model attribute value is given', () => {
			schema.extend( '$text', {
				allowAttributes: [ 'styled' ]
			} );

			const helper = upcastElementToAttribute( {
				view: {
					name: 'span',
					class: [ 'styled', 'styled-dark' ]
				},
				model: {
					key: 'styled',
					value: 'dark'
				}
			} );

			conversion.for( 'upcast' ).add( helper );

			expectResult(
				new ViewAttributeElement( 'span', { class: 'styled styled-dark' }, new ViewText( 'foo' ) ),
				'<$text styled="dark">foo</$text>'
			);
		} );

		it( 'model attribute value is a function', () => {
			schema.extend( '$text', {
				allowAttributes: [ 'fontSize' ]
			} );

			const helper = upcastElementToAttribute( {
				view: {
					name: 'span',
					style: {
						'font-size': /[\s\S]+/
					}
				},
				model: {
					key: 'fontSize',
					value: viewElement => {
						const fontSize = viewElement.getStyle( 'font-size' );
						const value = fontSize.substr( 0, fontSize.length - 2 );

						if ( value <= 10 ) {
							return 'small';
						} else if ( value > 12 ) {
							return 'big';
						}

						return null;
					}
				}
			} );

			conversion.for( 'upcast' ).add( helper );

			expectResult(
				new ViewAttributeElement( 'span', { style: 'font-size:9px' }, new ViewText( 'foo' ) ),
				'<$text fontSize="small">foo</$text>'
			);

			expectResult(
				new ViewAttributeElement( 'span', { style: 'font-size:12px' }, new ViewText( 'foo' ) ),
				'foo'
			);

			expectResult(
				new ViewAttributeElement( 'span', { style: 'font-size:14px' }, new ViewText( 'foo' ) ),
				'<$text fontSize="big">foo</$text>'
			);
		} );

		it( 'should not set an attribute if it is not allowed by schema', () => {
			const helper = upcastElementToAttribute( { view: 'em', model: 'italic' } );

			conversion.for( 'upcast' ).add( helper );

			expectResult(
				new ViewAttributeElement( 'em', null, new ViewText( 'foo' ) ),
				'foo'
			);
		} );

		it( 'should not do anything if returned model attribute is null', () => {
			const helperA = upcastElementToAttribute( { view: 'strong', model: 'bold' } );
			const helperB = upcastElementToAttribute( {
				view: 'strong',
				model: {
					key: 'bold',
					value: () => null
				}
			}, 'high' );

			conversion.for( 'upcast' ).add( helperA ).add( helperB );

			expectResult(
				new ViewAttributeElement( 'strong', null, new ViewText( 'foo' ) ),
				'<$text bold="true">foo</$text>'
			);
		} );
	} );

	describe( 'upcastAttributeToAttribute', () => {
		beforeEach( () => {
			conversion.for( 'upcast' ).add( upcastElementToElement( { view: 'img', model: 'image' } ) );

			schema.register( 'image', {
				inheritAllFrom: '$block'
			} );
		} );

		it( 'config.view is a string', () => {
			schema.extend( 'image', {
				allowAttributes: [ 'source' ]
			} );

			const helper = upcastAttributeToAttribute( { view: 'src', model: 'source' } );

			conversion.for( 'upcast' ).add( helper );

			expectResult(
				new ViewAttributeElement( 'img', { src: 'foo.jpg' } ),
				'<image source="foo.jpg"></image>'
			);
		} );

		it( 'config.view has only key set', () => {
			schema.extend( 'image', {
				allowAttributes: [ 'source' ]
			} );

			const helper = upcastAttributeToAttribute( { view: { key: 'src' }, model: 'source' } );

			conversion.for( 'upcast' ).add( helper );

			expectResult(
				new ViewAttributeElement( 'img', { src: 'foo.jpg' } ),
				'<image source="foo.jpg"></image>'
			);
		} );

		it( 'can be overwritten using priority', () => {
			schema.extend( 'image', {
				allowAttributes: [ 'src', 'source' ]
			} );

			const helperA = upcastAttributeToAttribute( { view: { key: 'src' }, model: 'src' } );
			const helperB = upcastAttributeToAttribute( { view: { key: 'src' }, model: 'source' }, 'normal' );

			conversion.for( 'upcast' ).add( helperA ).add( helperB );

			expectResult(
				new ViewAttributeElement( 'img', { src: 'foo.jpg' } ),
				'<image source="foo.jpg"></image>'
			);
		} );

		it( 'config.view has value set', () => {
			schema.extend( 'image', {
				allowAttributes: [ 'styled' ]
			} );

			const helper = upcastAttributeToAttribute( {
				view: {
					key: 'data-style',
					value: /[\s\S]*/
				},
				model: 'styled'
			} );

			conversion.for( 'upcast' ).add( helper );

			expectResult(
				new ViewAttributeElement( 'img', { 'data-style': 'dark' } ),
				'<image styled="dark"></image>'
			);
		} );

		it( 'model attribute value is a string', () => {
			schema.extend( 'image', {
				allowAttributes: [ 'styled' ]
			} );

			const helper = upcastAttributeToAttribute( {
				view: {
					name: 'img',
					key: 'class',
					value: 'styled-dark'
				},
				model: {
					key: 'styled',
					value: 'dark'
				}
			} );

			conversion.for( 'upcast' )
				.add( helper )
				.add( upcastElementToElement( { view: 'p', model: 'paragraph' } ) );

			expectResult(
				new ViewContainerElement( 'img', { class: 'styled-dark' } ),
				'<image styled="dark"></image>'
			);

			expectResult(
				new ViewContainerElement( 'img', { class: 'styled-xxx' } ),
				'<image></image>'
			);

			expectResult(
				new ViewContainerElement( 'p', { class: 'styled-dark' } ),
				'<paragraph></paragraph>'
			);
		} );

		it( 'model attribute value is a function', () => {
			schema.extend( 'image', {
				allowAttributes: [ 'styled' ]
			} );

			const helper = upcastAttributeToAttribute( {
				view: {
					key: 'class',
					value: /styled-[\S]+/
				},
				model: {
					key: 'styled',
					value: viewElement => {
						const regexp = /styled-([\S]+)/;
						const match = viewElement.getAttribute( 'class' ).match( regexp );

						return match[ 1 ];
					}
				}
			} );

			conversion.for( 'upcast' ).add( helper );

			expectResult(
				new ViewAttributeElement( 'img', { 'class': 'styled-dark' } ),
				'<image styled="dark"></image>'
			);
		} );

		it( 'should not set an attribute if it is not allowed by schema', () => {
			const helper = upcastAttributeToAttribute( { view: 'src', model: 'source' } );

			conversion.for( 'upcast' ).add( helper );

			expectResult(
				new ViewAttributeElement( 'img', { src: 'foo.jpg' } ),
				'<image></image>'
			);
		} );

		it( 'should not do anything if returned model attribute is null', () => {
			schema.extend( 'image', {
				allowAttributes: [ 'styled' ]
			} );

			const helperA = upcastAttributeToAttribute( {
				view: {
					key: 'class',
					value: 'styled'
				},
				model: {
					key: 'styled',
					value: true
				}
			} );

			const helperB = upcastAttributeToAttribute( {
				view: {
					key: 'class',
					value: 'styled'
				},
				model: {
					key: 'styled',
					value: () => null
				}
			} );

			conversion.for( 'upcast' ).add( helperA ).add( helperB );

			expectResult(
				new ViewAttributeElement( 'img', { class: 'styled' } ),
				'<image styled="true"></image>'
			);
		} );
	} );

	describe( 'upcastElementToMarker', () => {
		it( 'config.view is a string', () => {
			const helper = upcastElementToMarker( { view: 'marker-search', model: 'search' } );

			conversion.for( 'upcast' ).add( helper );

			const frag = new ViewDocumentFragment( [
				new ViewText( 'fo' ),
				new ViewUIElement( 'marker-search' ),
				new ViewText( 'oba' ),
				new ViewUIElement( 'marker-search' ),
				new ViewText( 'r' )
			] );

			const marker = { name: 'search', start: [ 2 ], end: [ 5 ] };

			expectResult( frag, 'foobar', marker );
		} );

		it( 'can be overwritten using priority', () => {
			const helperA = upcastElementToMarker( { view: 'marker-search', model: 'search-result' } );
			const helperB = upcastElementToMarker( { view: 'marker-search', model: 'search' }, 'high' );

			conversion.for( 'upcast' ).add( helperA ).add( helperB );

			const frag = new ViewDocumentFragment( [
				new ViewText( 'fo' ),
				new ViewUIElement( 'marker-search' ),
				new ViewText( 'oba' ),
				new ViewUIElement( 'marker-search' ),
				new ViewText( 'r' )
			] );

			const marker = { name: 'search', start: [ 2 ], end: [ 5 ] };

			expectResult( frag, 'foobar', marker );
		} );

		it( 'config.view is an object', () => {
			const helper = upcastElementToMarker( {
				view: {
					name: 'span',
					'data-marker': 'search'
				},
				model: 'search'
			} );

			conversion.for( 'upcast' ).add( helper );

			const frag = new ViewDocumentFragment( [
				new ViewText( 'f' ),
				new ViewUIElement( 'span', { 'data-marker': 'search' } ),
				new ViewText( 'oob' ),
				new ViewUIElement( 'span', { 'data-marker': 'search' } ),
				new ViewText( 'ar' )
			] );

			const marker = { name: 'search', start: [ 1 ], end: [ 4 ] };

			expectResult( frag, 'foobar', marker );
		} );

		it( 'config.model is a function', () => {
			const helper = upcastElementToMarker( {
				view: 'comment',
				model: viewElement => 'comment:' + viewElement.getAttribute( 'data-comment-id' )
			} );

			conversion.for( 'upcast' ).add( helper );

			const frag = new ViewDocumentFragment( [
				new ViewText( 'foo' ),
				new ViewUIElement( 'comment', { 'data-comment-id': 4 } ),
				new ViewText( 'b' ),
				new ViewUIElement( 'comment', { 'data-comment-id': 4 } ),
				new ViewText( 'ar' )
			] );

			const marker = { name: 'comment:4', start: [ 3 ], end: [ 4 ] };

			expectResult( frag, 'foobar', marker );
		} );
	} );

	function expectResult( viewToConvert, modelString, marker ) {
		const model = dispatcher.convert( viewToConvert );

		if ( marker ) {
			expect( model.markers.has( marker.name ) ).to.be.true;

			const convertedMarker = model.markers.get( marker.name );

			expect( convertedMarker.start.path ).to.deep.equal( marker.start );
			expect( convertedMarker.end.path ).to.deep.equal( marker.end );
		}

		expect( stringify( model ) ).to.equal( modelString );
	}
} );

describe( 'upcast-converters', () => {
	let dispatcher, schema, context, model;

	beforeEach( () => {
		model = new Model();
		schema = model.schema;

		schema.register( 'paragraph', { inheritAllFrom: '$block' } );
		schema.extend( '$text', { allowIn: '$root' } );

		context = [ '$root' ];

		dispatcher = new UpcastDispatcher( model, { schema } );
	} );

	describe( 'convertText()', () => {
		it( 'should return converter converting ViewText to ModelText', () => {
			const viewText = new ViewText( 'foobar' );

			dispatcher.on( 'text', convertText() );

			const conversionResult = dispatcher.convert( viewText );

			expect( conversionResult ).to.be.instanceof( ModelDocumentFragment );
			expect( conversionResult.getChild( 0 ) ).to.be.instanceof( ModelText );
			expect( conversionResult.getChild( 0 ).data ).to.equal( 'foobar' );
		} );

		it( 'should not convert already consumed texts', () => {
			const viewText = new ViewText( 'foofuckbafuckr' );

			// Default converter for elements. Returns just converted children. Added with lowest priority.
			dispatcher.on( 'text', convertText(), { priority: 'lowest' } );
			// Added with normal priority. Should make the above converter not fire.
			dispatcher.on( 'text', ( evt, data, conversionApi ) => {
				if ( conversionApi.consumable.consume( data.viewItem ) ) {
					const text = conversionApi.writer.createText( data.viewItem.data.replace( /fuck/gi, '****' ) );
					conversionApi.writer.insert( text, data.modelCursor );
					data.modelRange = ModelRange.createFromPositionAndShift( data.modelCursor, text.offsetSize );
					data.modelCursor = data.modelRange.end;
				}
			} );

			const conversionResult = dispatcher.convert( viewText, context );

			expect( conversionResult ).to.be.instanceof( ModelDocumentFragment );
			expect( conversionResult.getChild( 0 ) ).to.be.instanceof( ModelText );
			expect( conversionResult.getChild( 0 ).data ).to.equal( 'foo****ba****r' );
		} );

		it( 'should not convert text if it is wrong with schema', () => {
			schema.addChildCheck( ( ctx, childDef ) => {
				if ( childDef.name == '$text' && ctx.endsWith( '$root' ) ) {
					return false;
				}
			} );

			const viewText = new ViewText( 'foobar' );
			dispatcher.on( 'text', convertText() );

			let conversionResult = dispatcher.convert( viewText, context );

			expect( conversionResult ).to.be.instanceof( ModelDocumentFragment );
			expect( conversionResult.childCount ).to.equal( 0 );

			conversionResult = dispatcher.convert( viewText, [ '$block' ] );

			expect( conversionResult ).to.be.instanceof( ModelDocumentFragment );
			expect( conversionResult.childCount ).to.equal( 1 );
			expect( conversionResult.getChild( 0 ) ).to.be.instanceof( ModelText );
			expect( conversionResult.getChild( 0 ).data ).to.equal( 'foobar' );
		} );

		it( 'should support unicode', () => {
			const viewText = new ViewText( 'நிலைக்கு' );

			dispatcher.on( 'text', convertText() );

			const conversionResult = dispatcher.convert( viewText, context );

			expect( conversionResult ).to.be.instanceof( ModelDocumentFragment );
			expect( conversionResult.getChild( 0 ) ).to.be.instanceof( ModelText );
			expect( conversionResult.getChild( 0 ).data ).to.equal( 'நிலைக்கு' );
		} );
	} );

	describe( 'convertToModelFragment()', () => {
		it( 'should return converter converting whole ViewDocumentFragment to ModelDocumentFragment', () => {
			const viewFragment = new ViewDocumentFragment( [
				new ViewContainerElement( 'p', null, new ViewText( 'foo' ) ),
				new ViewText( 'bar' )
			] );

			// To get any meaningful results we have to actually convert something.
			dispatcher.on( 'text', convertText() );
			// This way P element won't be converted per-se but will fire converting it's children.
			dispatcher.on( 'element', convertToModelFragment() );
			dispatcher.on( 'documentFragment', convertToModelFragment() );

			const conversionResult = dispatcher.convert( viewFragment, context );

			expect( conversionResult ).to.be.instanceof( ModelDocumentFragment );
			expect( conversionResult.maxOffset ).to.equal( 6 );
			expect( conversionResult.getChild( 0 ).data ).to.equal( 'foobar' );
		} );

		it( 'should not convert already consumed (converted) changes', () => {
			const viewP = new ViewContainerElement( 'p', null, new ViewText( 'foo' ) );

			// To get any meaningful results we have to actually convert something.
			dispatcher.on( 'text', convertText() );
			// Default converter for elements. Returns just converted children. Added with lowest priority.
			dispatcher.on( 'element', convertToModelFragment(), { priority: 'lowest' } );
			// Added with normal priority. Should make the above converter not fire.
			dispatcher.on( 'element:p', ( evt, data, conversionApi ) => {
				if ( conversionApi.consumable.consume( data.viewItem, { name: true } ) ) {
					const paragraph = conversionApi.writer.createElement( 'paragraph' );

					conversionApi.writer.insert( paragraph, data.modelCursor );
					conversionApi.convertChildren( data.viewItem, ModelPosition.createAt( paragraph ) );

					data.modelRange = ModelRange.createOn( paragraph );
					data.modelCursor = data.modelRange.end;
				}
			} );

			const conversionResult = dispatcher.convert( viewP, context );

			expect( conversionResult ).to.be.instanceof( ModelDocumentFragment );
			expect( conversionResult.getChild( 0 ) ).to.be.instanceof( ModelElement );
			expect( conversionResult.getChild( 0 ).name ).to.equal( 'paragraph' );
			expect( conversionResult.getChild( 0 ).maxOffset ).to.equal( 3 );
			expect( conversionResult.getChild( 0 ).getChild( 0 ).data ).to.equal( 'foo' );
		} );

		it( 'should forward correct modelCursor', () => {
			const spy = sinon.spy();
			const view = new ViewDocumentFragment( [
				new ViewContainerElement( 'div', null, [ new ViewText( 'abc' ), new ViewContainerElement( 'foo' ) ] ),
				new ViewContainerElement( 'bar' )
			] );
			const position = ModelPosition.createAt( new ModelElement( 'element' ) );

			dispatcher.on( 'documentFragment', convertToModelFragment() );
			dispatcher.on( 'element', convertToModelFragment(), { priority: 'lowest' } );
			dispatcher.on( 'element:foo', ( evt, data ) => {
				// Be sure that current cursor is not the same as custom.
				expect( data.modelCursor ).to.not.equal( position );
				// Set custom cursor as a result of docFrag last child conversion.
				// This cursor should be forwarded by a documentFragment converter.
				data.modelCursor = position;
				// Be sure that callback was fired.
				spy();
			} );

			dispatcher.on( 'element:bar', ( evt, data ) => {
				expect( data.modelCursor ).to.equal( position );
				spy();
			} );

			dispatcher.convert( view );

			sinon.assert.calledTwice( spy );
		} );
	} );
} );
