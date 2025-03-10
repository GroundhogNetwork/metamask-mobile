import PubNub from 'pubnub';
import Logger from './Logger';

const PUB_KEY = process.env['MM_PUBNUB_PUB_KEY']; // eslint-disable-line dot-notation
const SUB_KEY = process.env['MM_PUBNUB_SUB_KEY']; // eslint-disable-line dot-notation

const EXPIRED_CODE_TIMEOUT = 1000;

export default class PubNubWrapper {
	pubnub;
	channelName;
	cipherKey;
	incomingDataStr = '';
	timeout = true;

	generateCipherKeyAndChannelName(selectedAddress) {
		const cipherKey = `${selectedAddress.substr(-4)}-${PubNub.generateUUID()}`;
		const channelName = `mmm-${PubNub.generateUUID()}`;
		return { cipherKey, channelName };
	}

	constructor(channelName, cipherKey) {
		this.pubnub = new PubNub({
			subscribeKey: SUB_KEY,
			publishKey: PUB_KEY,
			cipherKey,
			ssl: true
		});
		this.cipherKey = cipherKey;
		this.channelName = channelName;
	}

	/**
	 * Sets channelName and cipherKey to internal variables
	 *
	 * @param {string} channelName - Channel name to set
	 * @param {string} cipherKey - Cipher key to set
	 */
	setChannelNameAndCipherKey(channelName, cipherKey) {
		this.channelName = channelName;
		this.cipherKey = cipherKey;
	}

	/**
	 * Sends through pubnub a 'start-sync' event
	 */
	startSync() {
		return new Promise((resolve, reject) => {
			this.pubnub.publish(
				{
					message: {
						event: 'start-sync'
					},
					channel: this.channelName,
					sendByPost: false,
					storeInHistory: false
				},
				() => {
					setTimeout(() => {
						if (this.timeout) {
							reject();
						} else {
							resolve();
						}
					}, EXPIRED_CODE_TIMEOUT);
				}
			);
		});
	}

	/**
	 * Sends through pubnub an 'end-sync' event, calling a callback after that
	 *
	 * @param {func} callback - Callback to be called with event
	 */
	async endSync(callback) {
		this.pubnub.publish(
			{
				message: {
					event: 'end-sync',
					data: { status: 'success' }
				},
				channel: this.channelName,
				sendByPost: false,
				storeInHistory: false
			},
			() => {
				this.disconnectWebsockets();
				this.complete = true;
			}
		);
		callback();
	}

	/**
	 * Sends through pubnub an 'connection-info' event to reconnect to ws through a different
	 * channel and cipher key
	 *
	 * @param {string} selectedAddress - Selected address to generate cipher key with
	 * @returns - Promise resolving with this process is finished
	 */
	establishConnection(selectedAddress) {
		return new Promise(resolve => {
			const { cipherKey, channelName } = this.generateCipherKeyAndChannelName(selectedAddress);
			this.pubnub.publish(
				{
					message: {
						event: 'connection-info',
						channel: channelName,
						cipher: cipherKey
					},
					channel: this.channelName,
					sendByPost: false,
					storeInHistory: false
				},
				() => {
					this.disconnectWebsockets();
					this.pubnub = new PubNub({
						subscribeKey: SUB_KEY,
						publishKey: PUB_KEY,
						cipherKey,
						ssl: true
					});
					this.channelName = channelName;
					this.cipherKey = cipherKey;
					resolve();
				}
			);
		});
	}

	/**
	 * Adds a message listener to current pubnub object, seting timeout to false if a message is received
	 *
	 * @param {func} onErrorSync - Callback to be called in presence of an 'error-sync' event
	 * @param {func} onSyncingData - Callback to be called in presence of an 'syncing-data' event
	 */
	addMessageListener(onErrorSync, onSyncingData) {
		this.pubnub.addListener({
			message: ({ channel, message }) => {
				if (channel !== this.channelName || !message) {
					this.timeout = false;
					return false;
				}
				if (message.event === 'error-sync') {
					this.timeout = false;
					this.disconnectWebsockets();
					Logger.error('Sync failed', message, this.incomingDataStr);
					onErrorSync();
				}
				if (message.event === 'syncing-data') {
					this.timeout = false;
					this.incomingDataStr += message.data;
					if (message.totalPkg === message.currentPkg) {
						try {
							const data = JSON.parse(this.incomingDataStr);
							onSyncingData(data);
						} catch (e) {
							Logger.error('Sync failed at parsing', e);
						}
					}
				}
			}
		});
	}

	/**
	 * Subscribe to current channel name
	 */
	subscribe() {
		this.pubnub.subscribe({
			channels: [this.channelName],
			withPresence: false
		});
	}

	/**
	 * If pubnub object defined, disconnect from it
	 */
	disconnectWebsockets() {
		if (this.pubnub && this.pubnubListener) {
			this.pubnub.disconnect(this.pubnubListener);
		}
	}
}
