const uuidv4 = require('uuid/v4');

const states = {
	creating: "creating",
	preparing: "preparing",
	ready: "ready",
	updating: "updating",
	deleting: "deleting",
	invalid: "invalid"
}

class Item {
	constructor(id, type, state, owner, value) {
		this.id = id
		this.type = type
		this.state = state
		this.owner = owner
		this.value = value
		this.locked = false

		this.created = new Date()
		this.lastChange = new Date()
	}
	setState(state) {
		this.validateLock()
		this.state = state
		this.lastChange = new Date()
	}
	setOwner(owner) {
		this.validateLock()
		this.owner = owner
		this.lastChange = new Date()
	}
	setValue(value) {
		this.validateLock()
		this.value = value
		this.lastChange = new Date()
	}
	setLocked(locked) {
		this.locked = locked
		this.lastChange = new Date()
	}
	validateLock() {
		if (this.locked)
			throw new Error("Item " + id + " is locked!")
	}
}

class Pool {

	constructor(config) {
		this.id = uuidv4()
		this.items = { "" : new Item() }
		this.running = false
		this.workerId = ""

		this.poolName = config.poolName || "Pool"
		this.itemType = config.itemType || "Pool-Object"
		this.minItemsTotal = config.minItemsTotal || 1
		this.minItemsReady = config.minItemsReady || 1
		this.maxItemsTotal = config.maxItemsTotal || 10
		this.maxItemsReady = config.maxItemsReady || 10
		this.maxItemAge = config.maxItemAge || (24 * 60 * 60)
		this.refreshPeriod = config.refreshPeriod || 5

		this.itemFactory = config.itemFactory
		if (!this.itemFactory)
			throw ReferenceError(this.poolName + ".itemFactory must be set");

		this.itemPreparation = config.itemPreparation || (function (value) { return value })
	}

	start() {
		this.running = true
		this.workerId = setInterval(this.managePool, this.refreshPeriod)
	}

	stop() {
		this.running = false
		clearInterval(this.workerId)
	}

	async managePool() {
		var now = new Date().getTime();
		var items = Object.keys(this.items).map(k => this.items[k])
		//var lockedItems = items.filter(i => i.locked)
		var nonLockedItems = items.filter(i => !i.locked)
		var readyItems = nonLockedItems.filter(i => i.state === states.ready)
		var updatingItems = nonLockedItems.filter(i => i.state === states.updating)
		var preparingItems = nonLockedItems.filter(i => i.state === states.preparing)
		var creatingItems = nonLockedItems.filter(i => i.state === states.creating)
		//var deletingItems = poolItems.filter(i => i.state === states.deleting)
		//var invalidItems = poolItems.filter(i => i.state === states.invalid)
		var oldItems = nonLockedItems.filter(i => now - i.created.getTime > this.maxItemAge)
		var almostReadyItems = readyItems
			.concat(creatingItems)
			.concat(preparingItems.length)
			.concat(updatingItems)

		var itemsToCreate = this.minItemsTotal - nonLockedItems.length
		itemsToCreate = Math.max(itemsToCreate, this.minItemsReady - almostReadyItems.length)

		var itemsToDelete = nonLockedItems.length - this.maxItemsTotal
		itemsToDelete = Math.max(itemsToDelete, readyItems.length - this.maxItemsReady)

		if (itemsToCreate > 0)
			loop(this.minItemsTotal - nonLockedItems.length, this.createItem)
		if (itemsToDelete > 0)
			loop(readyItems.slice(0, itemsToDelete.length), this.deleteItem)
		if (oldItems.length > 0)
			loop(oldItems, this.deleteItem)
	}

	async createItem() {
		var item = new Item(uuidv4(), this.itemType, states.creating, null, null)
		this.items[item.id] = item
		var value = await this.itemFactory()
		item.setValue(value)
		item.setState(states.preparing)
		value = await this.itemPreparation(value)
		item.setValue(value)
		item.setState(states.ready)
	}

	async deleteItem(item) {
		// TODO: Delete the item
	}

}

function loop(countOrItems, action) {
	if (typeof(countOrItems) === "number")
		for (var i = 0; i < countOrItems; i++) action(i);
	else if (Array.isArray(countOrItems))
		for (var i = 0; i < countOrItems.length; i++) action(countOrItems[i]);
	else
		throw new Error("Unknown Loop operation type.")
}

module.exports = Pool