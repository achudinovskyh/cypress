import _ from 'lodash'
import { action } from 'mobx'
import eventManager from '../lib/event-manager'

export default class IframeModel {
  constructor ({ state, detachDom, removeHeadStyles, restoreDom, highlightEl, snapshotControls }) {
    this.state = state
    this.detachDom = detachDom
    this.removeHeadStyles = removeHeadStyles
    this.restoreDom = restoreDom
    this.highlightEl = highlightEl
    this.snapshotControls = snapshotControls

    this._reset()
  }

  listen () {
    eventManager.on('run:start', action('run:start', this._beforeRun))
    eventManager.on('run:end', action('run:start', this._afterRun))

    eventManager.on('viewport', action('viewport', this._updateViewport))
    eventManager.on('config', action('config', (config) => {
      this._updateViewport(_.map(config, 'viewportHeight', 'viewportWidth'))
    }))

    eventManager.on('url:changed', action('url:changed', this._updateUrl))
    eventManager.on('page:loading', action('page:loading', this._updateLoading))

    eventManager.on('show:snapshot', action('show:snapshot', this._setSnapshots))
    eventManager.on('hide:snapshot', action('hide:snapshot', this._clearSnapshots))

    eventManager.on('pin:snapshot', action('pin:snapshot', this._pinSnapshot))
    eventManager.on('unpin:snapshot', action('unpin:snapshot', this._unpinSnapshot))
  }

  _beforeRun = () => {
    this.state.isRunning = true
    this._reset()
    this._clearMessage()
  }

  _afterRun = () => {
    this.state.isRunning = false
  }

  _updateViewport = ({ viewportWidth, viewportHeight }) => {
    this.state.updateDimensions(viewportWidth, viewportHeight)
  }

  _updateUrl = (url) => {
    this.state.url = url
  }

  _updateLoading = (loading) => {
    this.state.loading = loading
  }

  _clearMessage = () => {
    this.state.clearMessage()
  }

  _setSnapshots = (snapshotProps) => {
    if (this.isSnapshotPinned) return

    if (this.state.isRunning) {
      return this._testsRunningError()
    }

    const { snapshots } = snapshotProps

    if (!snapshots || !snapshots.length) {
      this._clearSnapshots()
      this._setMissingSnapshotMessage()
      return
    }

    this.state.highlightUrl = true

    if (!this.originalState) {
      this._storeOriginalState()
    }

    this.detachedId = snapshotProps.id

    this._updateViewport(snapshotProps)
    this._updateUrl(snapshotProps.url)

    clearInterval(this.intervalId)

    const revert = action('revert:snapshot', this._showSnapshot)

    if (snapshots.length > 1) {
      let i = 0
      this.intervalId = setInterval(() => {
        if (this.isSnapshotPinned) return

        i += 1
        if (!snapshots[i]) {
          i = 0
        }

        revert(snapshots[i], snapshotProps)
      }, 800)
    }

    revert(snapshots[0], snapshotProps)
  }

  _showSnapshot = (snapshot, snapshotProps) => {
    this.state.messageTitle = 'DOM Snapshot'
    this.state.messageDescription = snapshot.name
    this.state.messageType = ''

    this.restoreDom(snapshot)

    if (snapshotProps.$el) {
      this.highlightEl(snapshot, snapshotProps)
    }
  }

  _clearSnapshots = () => {
    if (this.isSnapshotPinned) return

    clearInterval(this.intervalId)

    this.state.highlightUrl = false

    if (!this.originalState || !this.originalState.body) {
      return this._clearMessage()
    }

    const previousDetachedId = this.detachedId

    // process on next tick so we don't restore the dom if we're
    // about to receive another 'show:snapshot' event, else that would
    // be a huge waste
    setTimeout(action('clear:snapshots:next:tick', () => {
      // we want to only restore the dom if we haven't received
      // another snapshot by the time this function runs
      if (previousDetachedId !== this.detachedId) return

      this._updateViewport(this.originalState)
      this._updateUrl(this.originalState.url)
      this.restoreDom(this.originalState)
      this._clearMessage()

      this.originalState = null
      this.detachedId = null
    }))
  }

  _pinSnapshot = (snapshotProps) => {
    const { snapshots } = snapshotProps

    if (!snapshots || !snapshots.length) {
      runner.snapshotUnpinned()
      this._setMissingSnapshotMessage()
      return
    }

    clearInterval(this.intervalId)

    this.isSnapshotPinned = true
    this.restoreDom(snapshots[0])
    this.state.messageTitle = 'DOM Snapshot'
    this.state.messageDescription = 'pinned'
    this.state.messageControls = this.snapshotControls(snapshotProps)
  }

  _setMissingSnapshotMessage () {
    this.state.messageTitle = 'The snapshot is missing. Displaying current state of the DOM.'
    this.state.messageDescription = ''
    this.state.messageType = 'warning'
  }

  _unpinSnapshot = () => {
    this.isSnapshotPinned = false
    this.state.messageTitle = 'DOM Snapshot'
    this.state.messageDescription = ''
    this.state.messageControls = null
    this.state.snapshot.showingHighlights = true
    this.state.snapshot.stateIndex = 0
    this._clearSnapshots()
  }

  _testsRunningError () {
    this.state.messageTitle = 'Cannot show Snapshot while tests are running'
    this.state.messageType = 'warning'
  }

  _storeOriginalState () {
    const { body, htmlAttrs, headStyles, bodyStyles } = this.detachDom()

    this.originalState = {
      body,
      htmlAttrs,
      headStyles,
      bodyStyles,
      url: this.state.url,
      viewportWidth: this.state.width,
      viewportHeight: this.state.height,
    }
  }

  _reset () {
    this.detachedId = null
    this.intervalId = null
    this.originalState = null
    this.isSnapshotPinned = false
  }
}
