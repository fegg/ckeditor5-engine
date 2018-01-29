/* globals document */

import View from '../../../src/view/view';
import MutationObserver from '../../../src/view/observer/mutationobserver';
import count from '@ckeditor/ckeditor5-utils/src/count';
import KeyObserver from '../../../src/view/observer/keyobserver';
import FakeSelectionObserver from '../../../src/view/observer/fakeselectionobserver';
import SelectionObserver from '../../../src/view/observer/selectionobserver';
import FocusObserver from '../../../src/view/observer/focusobserver';
import createViewRoot from '../_utils/createroot';
import Observer from '../../../src/view/observer/observer';
import log from '@ckeditor/ckeditor5-utils/src/log';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';
import global from '@ckeditor/ckeditor5-utils/src/dom/global';
import ViewRange from '../../../src/view/range';
import RootEditableElement from '../../../src/view/rooteditableelement';
import ViewElement from '../../../src/view/element';
import { isBlockFiller, BR_FILLER } from '../../../src/view/filler';
import createElement from '@ckeditor/ckeditor5-utils/src/dom/createelement';

describe( 'view', () => {
	const DEFAULT_OBSERVERS_COUNT = 5;
	let domRoot, view, viewDocument, ObserverMock, instantiated, enabled, ObserverMockGlobalCount;

	testUtils.createSinonSandbox();

	beforeEach( () => {
		domRoot = createElement( document, 'div', {
			id: 'editor',
			contenteditable: 'true'
		} );

		document.body.appendChild( domRoot );

		view = new View();
		viewDocument = view.document;

		ObserverMock = class extends Observer {
			constructor( view ) {
				super( view );

				this.enable = sinon.spy();
				this.disable = sinon.spy();
				this.observe = sinon.spy();
			}
		};

		instantiated = 0;
		enabled = 0;

		ObserverMockGlobalCount = class extends Observer {
			constructor( view ) {
				super( view );
				instantiated++;

				this.observe = sinon.spy();
			}

			enable() {
				enabled++;
			}
		};
	} );

	afterEach( () => {
		domRoot.remove();
		view.destroy();
	} );

	it( 'should add default observers', () => {
		expect( count( view._observers ) ).to.equal( DEFAULT_OBSERVERS_COUNT );
		expect( view.getObserver( MutationObserver ) ).to.be.instanceof( MutationObserver );
		expect( view.getObserver( SelectionObserver ) ).to.be.instanceof( SelectionObserver );
		expect( view.getObserver( FocusObserver ) ).to.be.instanceof( FocusObserver );
		expect( view.getObserver( KeyObserver ) ).to.be.instanceof( KeyObserver );
		expect( view.getObserver( FakeSelectionObserver ) ).to.be.instanceof( FakeSelectionObserver );
	} );

	describe( 'attachDomRoot()', () => {
		it( 'should attach DOM element to main view element', () => {
			const domDiv = document.createElement( 'div' );
			const viewRoot = createViewRoot( viewDocument, 'div', 'main' );

			expect( count( view.domRoots ) ).to.equal( 0 );

			view.attachDomRoot( domDiv );

			expect( count( view.domRoots ) ).to.equal( 1 );

			expect( view.getDomRoot() ).to.equal( domDiv );
			expect( view.domConverter.mapViewToDom( viewRoot ) ).to.equal( domDiv );

			expect( view.renderer.markedChildren.has( viewRoot ) ).to.be.true;
		} );

		it( 'should attach DOM element to custom view element', () => {
			const domH1 = document.createElement( 'h1' );
			const viewH1 = createViewRoot( viewDocument, 'h1', 'header' );

			expect( count( view.domRoots ) ).to.equal( 0 );

			view.attachDomRoot( domH1, 'header' );

			expect( count( view.domRoots ) ).to.equal( 1 );
			expect( view.getDomRoot( 'header' ) ).to.equal( domH1 );
			expect( view.domConverter.mapViewToDom( viewH1 ) ).to.equal( domH1 );
			expect( view.renderer.markedChildren.has( viewH1 ) ).to.be.true;
		} );

		it( 'should call observe on each observer', () => {
			// The variable will be overwritten.
			view.destroy();

			view = new View();
			viewDocument = view.document;
			view.renderer.render = sinon.spy();

			const domDiv1 = document.createElement( 'div' );
			domDiv1.setAttribute( 'id', 'editor' );

			const domDiv2 = document.createElement( 'div' );
			domDiv2.setAttribute( 'id', 'editor' );

			const observerMock = view.addObserver( ObserverMock );
			const observerMockGlobalCount = view.addObserver( ObserverMockGlobalCount );

			createViewRoot( viewDocument, 'div', 'root1' );
			view.attachDomRoot( document.createElement( 'div' ), 'root1' );

			sinon.assert.calledOnce( observerMock.observe );
			sinon.assert.calledOnce( observerMockGlobalCount.observe );
		} );
	} );

	describe( 'addObserver()', () => {
		beforeEach( () => {
			// The variable will be overwritten.
			view.destroy();

			view = new View();
			viewDocument = view.document;
			view.renderer.render = sinon.spy();
		} );

		afterEach( () => {
			view.destroy();
		} );

		it( 'should be instantiated and enabled on adding', () => {
			const observerMock = view.addObserver( ObserverMock );

			expect( view._observers.size ).to.equal( DEFAULT_OBSERVERS_COUNT + 1 );

			expect( observerMock ).to.have.property( 'document', viewDocument );
			sinon.assert.calledOnce( observerMock.enable );
		} );

		it( 'should return observer instance each time addObserver is called', () => {
			const observerMock1 = view.addObserver( ObserverMock );
			const observerMock2 = view.addObserver( ObserverMock );

			expect( observerMock1 ).to.be.instanceof( ObserverMock );
			expect( observerMock2 ).to.be.instanceof( ObserverMock );
			expect( observerMock1 ).to.equals( observerMock2 );
		} );

		it( 'should instantiate one observer only once', () => {
			view.addObserver( ObserverMockGlobalCount );
			view.addObserver( ObserverMockGlobalCount );

			expect( view._observers.size ).to.equal( DEFAULT_OBSERVERS_COUNT + 1 );
			expect( instantiated ).to.equal( 1 );
			expect( enabled ).to.equal( 1 );

			view.addObserver( ObserverMock );
			expect( view._observers.size ).to.equal( DEFAULT_OBSERVERS_COUNT + 2 );
		} );

		it( 'should instantiate child class of already registered observer', () => {
			class ObserverMock extends Observer {
				enable() {}
			}
			class ChildObserverMock extends ObserverMock {
				enable() {}
			}

			view.addObserver( ObserverMock );
			view.addObserver( ChildObserverMock );

			expect( view._observers.size ).to.equal( DEFAULT_OBSERVERS_COUNT + 2 );
		} );

		it( 'should be disabled and re-enabled on render', () => {
			const observerMock = view.addObserver( ObserverMock );
			view.render();

			sinon.assert.calledOnce( observerMock.disable );
			sinon.assert.calledOnce( view.renderer.render );
			sinon.assert.calledTwice( observerMock.enable );
		} );

		it( 'should call observe on each root', () => {
			createViewRoot( viewDocument, 'div', 'roo1' );
			createViewRoot( viewDocument, 'div', 'roo2' );

			view.attachDomRoot( document.createElement( 'div' ), 'roo1' );
			view.attachDomRoot( document.createElement( 'div' ), 'roo2' );

			const observerMock = view.addObserver( ObserverMock );

			sinon.assert.calledTwice( observerMock.observe );
		} );
	} );

	describe( 'getObserver()', () => {
		it( 'should return observer it it is added', () => {
			const addedObserverMock = view.addObserver( ObserverMock );
			const getObserverMock = view.getObserver( ObserverMock );

			expect( getObserverMock ).to.be.instanceof( ObserverMock );
			expect( getObserverMock ).to.equal( addedObserverMock );
		} );

		it( 'should return undefined if observer is not added', () => {
			const getObserverMock = view.getObserver( ObserverMock );

			expect( getObserverMock ).to.be.undefined;
		} );
	} );

	describe( 'scrollToTheSelection()', () => {
		beforeEach( () => {
			// Silence the Rect warnings.
			testUtils.sinon.stub( log, 'warn' );
		} );

		it( 'does nothing when there are no ranges in the selection', () => {
			const stub = testUtils.sinon.stub( global.window, 'scrollTo' );

			view.scrollToTheSelection();
			sinon.assert.notCalled( stub );
		} );

		it( 'scrolls to the first range in selection with an offset', () => {
			const root = createViewRoot( viewDocument, 'div', 'main' );
			const stub = testUtils.sinon.stub( global.window, 'scrollTo' );
			const range = ViewRange.createIn( root );

			view.attachDomRoot( domRoot );

			// Make sure the window will have to scroll to the domRoot.
			Object.assign( domRoot.style, {
				position: 'absolute',
				top: '-1000px',
				left: '-1000px'
			} );

			viewDocument.selection.setTo( range );

			view.scrollToTheSelection();
			sinon.assert.calledWithMatch( stub, sinon.match.number, sinon.match.number );
		} );
	} );

	describe( 'disableObservers()', () => {
		it( 'should disable observers', () => {
			const addedObserverMock = view.addObserver( ObserverMock );

			expect( addedObserverMock.enable.calledOnce ).to.be.true;
			expect( addedObserverMock.disable.called ).to.be.false;

			view.disableObservers();

			expect( addedObserverMock.enable.calledOnce ).to.be.true;
			expect( addedObserverMock.disable.calledOnce ).to.be.true;
		} );
	} );

	describe( 'enableObservers()', () => {
		it( 'should enable observers', () => {
			const addedObserverMock = view.addObserver( ObserverMock );

			view.disableObservers();

			expect( addedObserverMock.enable.calledOnce ).to.be.true;
			expect( addedObserverMock.disable.calledOnce ).to.be.true;

			view.enableObservers();

			expect( addedObserverMock.enable.calledTwice ).to.be.true;
			expect( addedObserverMock.disable.calledOnce ).to.be.true;
		} );
	} );

	describe( 'focus()', () => {
		let domEditable, viewEditable;

		beforeEach( () => {
			domEditable = document.createElement( 'div' );
			domEditable.setAttribute( 'contenteditable', 'true' );
			document.body.appendChild( domEditable );
			viewEditable = createViewRoot( viewDocument, 'div', 'main' );
			view.attachDomRoot( domEditable );
			viewDocument.selection.setTo( ViewRange.createFromParentsAndOffsets( viewEditable, 0, viewEditable, 0 ) );
		} );

		afterEach( () => {
			document.body.removeChild( domEditable );
		} );

		it( 'should focus editable with selection', () => {
			const converterFocusSpy = testUtils.sinon.spy( view.domConverter, 'focus' );
			const renderSpy = testUtils.sinon.spy( view, 'render' );

			view.focus();

			expect( converterFocusSpy.called ).to.be.true;
			expect( renderSpy.calledOnce ).to.be.true;
			expect( document.activeElement ).to.equal( domEditable );
			const domSelection = document.getSelection();
			expect( domSelection.rangeCount ).to.equal( 1 );
			const domRange = domSelection.getRangeAt( 0 );
			expect( domRange.startContainer ).to.equal( domEditable );
			expect( domRange.startOffset ).to.equal( 0 );
			expect( domRange.collapsed ).to.be.true;
		} );

		it( 'should not focus if document is already focused', () => {
			const converterFocusSpy = testUtils.sinon.spy( view.domConverter, 'focus' );
			const renderSpy = testUtils.sinon.spy( view, 'render' );
			viewDocument.isFocused = true;

			view.focus();

			expect( converterFocusSpy.called ).to.be.false;
			expect( renderSpy.called ).to.be.false;
		} );

		it( 'should log warning when no selection', () => {
			const logSpy = testUtils.sinon.stub( log, 'warn' );
			viewDocument.selection.setTo( null );

			view.focus();
			expect( logSpy.calledOnce ).to.be.true;
			expect( logSpy.args[ 0 ][ 0 ] ).to.match( /^view-focus-no-selection/ );
		} );
	} );

	describe( 'isFocused', () => {
		it( 'should change renderer.isFocused too', () => {
			expect( viewDocument.isFocused ).to.equal( false );
			expect( view.renderer.isFocused ).to.equal( false );

			viewDocument.isFocused = true;

			expect( viewDocument.isFocused ).to.equal( true );
			expect( view.renderer.isFocused ).to.equal( true );
		} );
	} );

	describe( 'render()', () => {
		it( 'disable observers, renders and enable observers', () => {
			const observerMock = view.addObserver( ObserverMock );
			const renderStub = sinon.stub( view.renderer, 'render' );

			view.render();

			sinon.assert.callOrder( observerMock.disable, renderStub, observerMock.enable );
		} );
	} );

	describe( 'view and DOM integration', () => {
		it( 'should remove content of the DOM', () => {
			const domDiv = createElement( document, 'div', { id: 'editor' }, [
				createElement( document, 'p' ),
				createElement( document, 'p' )
			] );

			const view = new View();
			const viewDocument = view.document;

			createRoot( 'div', 'main', viewDocument );
			view.attachDomRoot( domDiv );
			view.render();

			expect( domDiv.childNodes.length ).to.equal( 1 );
			expect( isBlockFiller( domDiv.childNodes[ 0 ], BR_FILLER ) ).to.be.true;

			view.destroy();
		} );

		it( 'should render changes in the Document', () => {
			const domDiv = document.createElement( 'div' );

			const view = new View();
			const viewDocument = view.document;
			createRoot( 'div', 'main', viewDocument );
			view.attachDomRoot( domDiv );

			viewDocument.getRoot().appendChildren( new ViewElement( 'p' ) );
			view.render();

			expect( domDiv.childNodes.length ).to.equal( 1 );
			expect( domDiv.childNodes[ 0 ].tagName ).to.equal( 'P' );

			view.destroy();
		} );

		it( 'should render attribute changes', () => {
			const domRoot = document.createElement( 'div' );

			const view = new View();
			const viewDocument = view.document;
			const viewRoot = createRoot( 'div', 'main', viewDocument );

			view.attachDomRoot( domRoot );

			const viewP = new ViewElement( 'p', { class: 'foo' } );
			viewRoot.appendChildren( viewP );
			view.render();

			expect( domRoot.childNodes.length ).to.equal( 1 );
			expect( domRoot.childNodes[ 0 ].getAttribute( 'class' ) ).to.equal( 'foo' );

			viewP.setAttribute( 'class', 'bar' );
			view.render();

			expect( domRoot.childNodes.length ).to.equal( 1 );
			expect( domRoot.childNodes[ 0 ].getAttribute( 'class' ) ).to.equal( 'bar' );

			view.destroy();
		} );
	} );

	function createRoot( name, rootName, viewDoc ) {
		const viewRoot = new RootEditableElement( name );

		viewRoot.rootName = rootName;
		viewRoot.document = viewDoc;
		viewDoc.roots.add( viewRoot );

		return viewRoot;
	}
} );
