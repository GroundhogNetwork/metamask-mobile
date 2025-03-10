import React, { PureComponent } from 'react';
import PaymentChannelsClient from '../../../core/PaymentChannelsClient';
import {
	InteractionManager,
	ScrollView,
	Alert,
	Text,
	View,
	SafeAreaView,
	StyleSheet,
	ActivityIndicator,
	TouchableOpacity,
	Dimensions,
	Platform,
	Clipboard
} from 'react-native';
import PropTypes from 'prop-types';
import { colors, fontStyles } from '../../../styles/common';
import StyledButton from '../../UI/StyledButton';
import QRCode from 'react-native-qrcode-svg';
import IonicIcon from 'react-native-vector-icons/Ionicons';
import getNavbarOptions from '../../UI/Navbar';
import DefaultTabBar from 'react-native-scrollable-tab-view/DefaultTabBar';
import { connect } from 'react-redux';
import { strings } from '../../../../locales/i18n';
import Logger from '../../../util/Logger';
import { balanceToFiat, toBN } from '../../../util/number';
import AssetCard from '../AssetCard';
import Engine from '../../../core/Engine';
import { toChecksumAddress } from 'ethereumjs-util';
import { setPaymentChannelTransaction } from '../../../actions/transaction';
import Transactions from '../../UI/Transactions';
import { BNToHex } from 'gaba/util';
import Networks from '../../../util/networks';
import Modal from 'react-native-modal';
import PaymentChannelWelcome from './PaymentChannelWelcome';
import AsyncStorage from '@react-native-community/async-storage';
import AppConstants from '../../../core/AppConstants';
import Analytics from '../../../core/Analytics';
import { withNavigationFocus } from 'react-navigation';
import DeviceSize from '../../../util/DeviceSize';
import { showAlert } from '../../../actions/alert';
import GlobalAlert from '../../UI/GlobalAlert';

const DAI_ADDRESS = AppConstants.DAI_ADDRESS;

const styles = StyleSheet.create({
	mainWrapper: {
		backgroundColor: colors.white,
		flex: 1
	},
	scrollviewWrapper: {
		flex: 1,
		minHeight: 600
	},
	wrapper: {
		flex: 1,
		paddingBottom: 0
	},
	data: {
		backgroundColor: colors.grey000,
		borderBottomColor: colors.grey200,
		borderBottomWidth: 1
	},
	button: {
		paddingVertical: 5,
		width: '48%',
		height: 44
	},
	depositButton: {
		width: '80%',
		marginVertical: 15
	},
	buttonText: {
		fontSize: 14
	},
	loader: {
		backgroundColor: colors.white,
		flex: 1,
		minHeight: 120,
		justifyContent: 'center',
		alignItems: 'center'
	},
	assetCardWrapper: {
		marginTop: 16,
		marginHorizontal: 20
	},
	actionsWrapper: {
		flexDirection: 'column',
		marginVertical: 10,
		marginHorizontal: 20
	},
	secondActionsWrapper: {
		flexDirection: 'row',
		marginVertical: 10,
		justifyContent: 'space-between'
	},
	sendButton: {
		width: '100%',
		marginVertical: 10
	},
	tabUnderlineStyle: {
		height: 2,
		backgroundColor: colors.blue
	},
	tabStyle: {
		paddingBottom: 0
	},
	tabTextStyle: {
		fontSize: 12,
		letterSpacing: 0.5,
		...fontStyles.bold
	},
	noFundsWrapper: {
		marginHorizontal: 10,
		marginTop: 40,
		alignItems: 'center'
	},
	transactionsWrapper: {
		marginHorizontal: 0
	},
	noFundsTitle: {
		...fontStyles.normal,
		color: colors.grey500,
		fontSize: 18
	},
	noFundsDescription: {
		...fontStyles.normal,
		color: colors.grey500,
		fontSize: 12,
		margin: 20,
		textAlign: 'center',
		width: 250
	},
	bottomModal: {
		margin: 0
	},
	detailsWrapper: {
		padding: 10,
		alignItems: 'center'
	},
	qrCode: {
		marginBottom: 16,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 36,
		paddingBottom: 24,
		paddingTop: 16,
		backgroundColor: colors.grey000,
		borderRadius: 8
	},
	qrCodeWrapper: {
		borderColor: colors.grey300,
		borderRadius: 8,
		borderWidth: 1,
		padding: 15
	},
	addressWrapper: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 16,
		paddingTop: 16,
		marginTop: 10,
		borderRadius: 5,
		backgroundColor: colors.grey000
	},
	titleQr: {
		flexDirection: 'row'
	},
	closeIcon: {
		position: 'absolute',
		right: DeviceSize.isSmallDevice() ? (Platform.OS === 'ios' ? -30 : -30) : Platform.OS === 'ios' ? -40 : -50,
		bottom: Platform.OS === 'ios' ? 8 : 10
	},
	addressTitle: {
		fontSize: 16,
		marginBottom: 16,
		...fontStyles.normal
	},
	address: {
		...fontStyles.normal,
		fontSize: Platform.OS === 'ios' ? 14 : 20,
		textAlign: 'center'
	}
});

/**
/* View that contains all the UI to
/* deposit, send, receive and withdraw
/* instant payments
*/
class PaymentChannel extends PureComponent {
	static navigationOptions = ({ navigation }) => getNavbarOptions('payment_channel.insta_pay', navigation, true);

	static propTypes = {
		/**
		/* navigation object required to push and pop other views
		*/
		navigation: PropTypes.object,
		/**
		 * Symbol for base asset
		 */
		nativeCurrency: PropTypes.string,
		/**
		 * Currently-active ISO 4217 currency code
		 */
		currentCurrency: PropTypes.string,
		/**
		 * Object containing token exchange rates in the format address => exchangeRate
		 */
		contractExchangeRates: PropTypes.object,
		/**
		 * ETH-to-current currency conversion rate from CurrencyRateController
		 */
		conversionRate: PropTypes.number,
		/**
		 * Action that sets a tokens type transaction
		 */
		setPaymentChannelTransaction: PropTypes.func,
		/**
		 * An array that represents the user transactions on chain
		 */
		transactions: PropTypes.array,
		/**
		 * An array that represents the user internal transactions
		 */
		internalTransactions: PropTypes.array,
		/**
		 * NetworkController povider object
		 */
		provider: PropTypes.object,
		/**
		 * Selected address
		 */
		selectedAddress: PropTypes.string,
		/**
		 * React navigation prop to know if this view is focused
		 */
		isFocused: PropTypes.bool,
		/**
		 * Flag that determines if payment channels are enabled
		 */
		paymentChannelsEnabled: PropTypes.bool,
		/**
		/* Triggers global alert
		*/
		showAlert: PropTypes.func
	};

	state = {
		balance: '0.00',
		balanceFiat: undefined,
		status: { type: null },
		qrModalVisible: false,
		sendAmount: '',
		sendRecipient: '',
		depositAmount: '',
		exchangeRate: undefined,
		displayWelcomeModal: false,
		connextStateDisabled: false
	};

	client = null;
	sending = false;
	depositing = false;
	withdrawing = false;

	onStateChange = state => {
		if (state.balance !== this.state.balance || state.status.type !== this.state.status.type || !this.state.ready) {
			this.setState({
				balance: state.balance,
				status: state.status,
				transactions: this.handleTransactions(state.transactions),
				ready: true
			});
			this.getBalanceFiat(state.balance);
		}
	};

	componentDidMount() {
		InteractionManager.runAfterInteractions(() => {
			this.init();
		});

		this.mounted = true;
	}

	init = () => {
		setTimeout(() => {
			PaymentChannelsClient.hub.on('state::change', this.onStateChange);
			PaymentChannelsClient.hub.on('state::cs_chainsaw_error', this.handleChainsawError);
		}, 1000);
		this.checkifEnabled();
	};

	checkifEnabled = async () => {
		const vars = Analytics.getRemoteVariables();
		if (vars && vars.paymentChannelsEnabled === false) {
			// If the user has funds we should
			// withdraw everything automatically
			if (parseFloat(this.state.balance) > 0) {
				Alert.alert(
					strings('payment_channel.disabled_withdraw_title'),
					strings('payment_channel.disabled_withdraw_message'),
					[
						{
							text: strings('payment_channel.disabled_withdraw_btn'),
							onPress: async () => {
								try {
									this.withdrawing = true;
									await PaymentChannelsClient.withdrawAll();
									this.withdrawing = false;
									Logger.log('withdraw succesful');
								} catch (e) {
									this.withdrawing = false;
									Logger.log('withdraw error', e);
								}
								setTimeout(() => {
									this.props.navigation.pop();
								}, 1000);
							}
						}
					]
				);
			} else {
				Alert.alert(strings('payment_channel.disabled_title'), strings('payment_channel.disabled_message'), [
					{
						text: strings('payment_channel.disabled_btn'),
						onPress: () => {
							this.props.navigation.pop();
						}
					}
				]);
			}
		} else {
			const paymentChannelFirstTime = await AsyncStorage.getItem('@MetaMask:paymentChannelFirstTime', '');
			if (!paymentChannelFirstTime) {
				this.setState({ displayWelcomeModal: true });
			}
		}
	};

	componentDidUpdate(prevProps) {
		// Handle turning payment channels off from settings
		if (
			prevProps.isFocused !== this.props.isFocused &&
			!this.props.paymentChannelsEnabled &&
			this.props.isFocused
		) {
			this.props.navigation.navigate('BrowserView');
		}
		// Reinit on network / account changes
		if (
			prevProps.selectedAddress !== this.props.selectedAddress ||
			prevProps.provider.type !== this.props.provider.type
		) {
			this.reinitialize();
		}
	}

	reinitialize = () => {
		Logger.log('PC::reinitialize');
		this.removeListeners();
		this.setState({ ready: false });
		this.init();
	};

	handleChainsawError = ({ channelState }) => {
		if (this.props.isFocused) {
			!this.state.connextStateDisabled &&
				Alert.alert(strings('payment_channel.error_title'), strings('payment_channel.error_desc'));
			this.setState({ connextStateDisabled: true });
			Logger.log('InstaPay:ChainSawError', channelState);
			Logger.error('InstaPay:ChainSawError');
		}
	};

	handleTransactions = transactions => {
		const { transactions: onChainTransactions, provider, internalTransactions, selectedAddress } = this.props;
		const parsedTransactions = transactions.map(tx => ({
			time: Date.parse(tx.createdOn),
			status: 'confirmed',
			id: tx.id.toString(),
			paymentChannelTransaction: true,
			transaction: {
				from: tx.sender,
				to: tx.recipient,
				value: BNToHex(toBN(tx.amount.amountToken))
			}
		}));
		onChainTransactions.forEach(tx => {
			if (
				tx.transaction.from.toLowerCase() === selectedAddress.toLowerCase() &&
				tx.toSmartContract &&
				Networks[provider.type].networkId.toString() === tx.networkID &&
				tx.transaction.data.substring(0, 10) === '0xea682e37' &&
				tx.status === 'confirmed'
			) {
				parsedTransactions.push({
					...tx,
					actionKey: strings('transactions.instant_payment_deposit_tx'),
					paymentChannelTransaction: true
				});
			}
		});
		internalTransactions &&
			internalTransactions.forEach(tx => {
				if (
					Networks[provider.type].networkId.toString() === tx.networkID &&
					tx.transaction.to.toLowerCase() === selectedAddress.toLowerCase()
				) {
					parsedTransactions.push({
						...tx,
						from: undefined,
						id: tx.transactionHash,
						actionKey: strings('transactions.instant_payment_withdraw_tx'),
						paymentChannelTransaction: true
					});
				}
			});
		const sortedTransactions = parsedTransactions.sort((a, b) => b.time - a.time);
		return sortedTransactions;
	};

	componentWillUnmount() {
		this.removeListeners();
	}

	removeListeners() {
		PaymentChannelsClient.hub.removeListener('state::change', this.onStateChange);
		PaymentChannelsClient.hub.removeListener('state::cs_chainsaw_error', this.handleChainsawError);
	}

	copyAccountToClipboard = async () => {
		const { selectedAddress } = this.props;
		await Clipboard.setString(selectedAddress);
		this.props.showAlert({
			isVisible: true,
			autodismiss: 1500,
			content: 'clipboard-alert',
			data: { msg: strings('account_details.account_copied_to_clipboard') }
		});
	};

	send = async () => {
		if (this.sending) {
			return;
		}

		try {
			const params = {
				sendRecipient: this.state.sendRecipient,
				sendAmount: this.state.sendAmount
			};

			if (isNaN(params.sendAmount) || params.sendAmount.trim() === '') {
				Alert.alert(strings('payment_channel.error'), strings('payment_channel.enter_the_amount'));
				return false;
			}

			if (!params.sendRecipient) {
				Alert.alert(strings('payment_channel.error'), strings('payment_channel.enter_the_recipient'));
			}

			Logger.log('Sending ', params);
			this.sending = true;
			this.props.navigation.pop();
			await PaymentChannelsClient.send(params);
			this.sending = false;

			Logger.log('Send succesful');
		} catch (e) {
			let msg = strings('payment_channel.unknown_error');
			if (e.message === 'insufficient_balance') {
				msg = strings('payment_channel.insufficient_balance');
			}
			Alert.alert(strings('payment_channel.error'), msg);
			Logger.log('buy error error', e);
			this.sending = false;
		}
	};

	withdraw = async () => {
		if (this.withdrawing) {
			return;
		}
		Alert.alert(
			strings('payment_channel.withdraw_funds'),
			`${strings('payment_channel.withdraw_intro')}. ${strings('payment_channel.withdraw_info')}.\n${strings(
				'payment_channel.withdraw_note'
			)}.`,
			[
				{
					text: strings('payment_channel.cancel'),
					onPress: () => false,
					style: 'cancel'
				},
				{
					text: strings('payment_channel.confirm'),
					onPress: async () => {
						try {
							this.withdrawing = true;
							await PaymentChannelsClient.withdrawAll();
							this.withdrawing = false;
							Logger.log('withdraw succesful');
						} catch (e) {
							this.withdrawing = false;
							Logger.log('withdraw error', e);
						}
					}
				}
			],
			{ cancelable: false }
		);
	};

	onSend = () => {
		this.props.setPaymentChannelTransaction({
			address: '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
			decimals: 18,
			logo: 'dai.svg',
			symbol: 'DAI'
		});
		this.props.navigation.navigate('PaymentChannelSend');
	};

	onDeposit = () => {
		this.props.navigation.navigate('PaymentChannelDeposit');
	};

	renderInfo() {
		const { balance, balanceFiat } = this.state;
		const isDisabled = this.areButtonsDisabled();
		const noFundsAndNoHistory = this.state.balance === '0.00' && !this.state.transactions.length;
		const noFunds = this.state.balance === '0.00';
		return (
			<View style={styles.data}>
				<View style={styles.assetCardWrapper}>
					<AssetCard
						balance={balance + ' ' + strings('unit.dai')}
						balanceFiat={balanceFiat}
						description={strings('payment_channel.asset_card_desc')}
					/>
				</View>
				<View style={styles.actionsWrapper}>
					{!noFundsAndNoHistory && (
						<View>
							<StyledButton
								containerStyle={[styles.button, styles.sendButton]}
								style={styles.buttonText}
								type={'confirm'}
								onPress={this.onSend}
								disabled={isDisabled || noFunds}
							>
								{strings('payment_channel.send_buttton')}
							</StyledButton>
							<View style={styles.secondActionsWrapper}>
								<StyledButton
									containerStyle={styles.button}
									style={styles.buttonText}
									type={'info'}
									onPress={this.onDeposit}
									disabled={isDisabled}
								>
									{strings('payment_channel.deposit_buttton')}
								</StyledButton>
								<StyledButton
									containerStyle={styles.button}
									style={styles.buttonText}
									type={'info'}
									onPress={this.withdraw}
									disabled={isDisabled || noFunds}
								>
									{strings('payment_channel.withdraw_buttton')}
								</StyledButton>
							</View>
						</View>
					)}
				</View>
			</View>
		);
	}

	scan = () => {
		this.props.navigation.navigate('QRScanner', {
			onScanSuccess: meta => {
				if (meta.target_address) {
					this.setState({ sendRecipient: meta.target_address });
				}
			}
		});
	};

	getBalanceFiat = async balance => {
		const { TokenRatesController } = Engine.context;
		const { nativeCurrency, currentCurrency, contractExchangeRates, conversionRate } = this.props;
		let exchangeRate;
		if (Object.keys(contractExchangeRates).includes(toChecksumAddress(DAI_ADDRESS))) {
			exchangeRate = contractExchangeRates[toChecksumAddress(DAI_ADDRESS)];
		} else {
			const res = await TokenRatesController.fetchExchangeRate(
				`contract_addresses=${DAI_ADDRESS}&vs_currencies=${nativeCurrency.toLowerCase()}`
			);
			if (!!res && Object.keys(res).includes(DAI_ADDRESS)) {
				exchangeRate = res[DAI_ADDRESS][nativeCurrency.toLowerCase()];
			}
		}

		const balanceFiat = exchangeRate && balanceToFiat(balance, conversionRate, exchangeRate, currentCurrency);
		this.setState({ balanceFiat, exchangeRate });
	};

	closeQrModal = () => {
		this.setState({ qrModalVisible: false });
	};

	openQrModal = () => {
		this.setState({ qrModalVisible: true });
	};

	areButtonsDisabled = () => {
		const { status, connextStateDisabled } = this.state;
		if (status && status.type) {
			return status.type.indexOf('_PENDING') !== -1;
		}
		if (connextStateDisabled) {
			return connextStateDisabled;
		}
		return false;
	};

	renderNoFunds() {
		const isDisabled = this.areButtonsDisabled();

		return (
			<View>
				{this.renderInfo()}
				<View style={styles.noFundsWrapper}>
					<Text style={styles.noFundsTitle}>{strings('payment_channel.no_funds_title')}</Text>
					<Text style={styles.noFundsDescription}>{strings('payment_channel.no_funds_desc')}</Text>
					<StyledButton
						containerStyle={[styles.button, styles.depositButton]}
						style={styles.buttonText}
						type={'info'}
						onPress={this.onDeposit}
						testID={'submit-button'}
						disabled={isDisabled}
					>
						{strings('payment_channel.no_funds_action')}
					</StyledButton>

					<Text style={styles.noFundsDescription}>{strings('payment_channel.ask_a_friend')}</Text>
					<StyledButton
						containerStyle={[styles.button, styles.depositButton]}
						style={styles.buttonText}
						type={'info'}
						onPress={this.openQrModal}
						testID={'receive-button'}
					>
						{strings('payment_channel.receive_funds_action')}
					</StyledButton>
				</View>
			</View>
		);
	}

	renderTransactionsHistory() {
		const { navigation, conversionRate, currentCurrency, selectedAddress } = this.props;
		return (
			<ScrollView style={styles.transactionsWrapper}>
				<Transactions
					header={this.renderInfo()}
					navigation={navigation}
					transactions={this.state.transactions}
					conversionRate={conversionRate}
					currentCurrency={currentCurrency}
					exchangeRate={this.state.exchangeRate}
					selectedAddress={selectedAddress}
					loading={false}
				/>
			</ScrollView>
		);
	}

	renderTabBar() {
		return (
			<DefaultTabBar
				underlineStyle={styles.tabUnderlineStyle}
				activeTextColor={colors.blue}
				inactiveTextColor={colors.fontTertiary}
				backgroundColor={colors.white}
				tabStyle={styles.tabStyle}
				textStyle={styles.tabTextStyle}
			/>
		);
	}

	renderContent() {
		if (!this.state.ready) {
			return (
				<View style={styles.loader}>
					<ActivityIndicator size="small" />
				</View>
			);
		}
		const noFundsAndNoHistory = this.state.balance === '0.00' && !this.state.transactions.length;

		return (
			<View>
				{noFundsAndNoHistory && this.renderNoFunds()}
				{!noFundsAndNoHistory && this.renderTransactionsHistory()}
			</View>
		);
	}

	closeWelcomeModal = async () => {
		await AsyncStorage.setItem('@MetaMask:paymentChannelFirstTime', '1');
		this.setState({ displayWelcomeModal: false });
	};

	render() {
		return (
			<SafeAreaView style={styles.mainWrapper}>
				<ScrollView
					contentContainerStyle={styles.scrollviewWrapper}
					style={styles.mainWrapper}
					testID={'payment-channels-screen'}
				>
					<View style={styles.wrapper}>{this.renderContent()}</View>
				</ScrollView>
				<Modal
					isVisible={this.state.displayWelcomeModal}
					onBackdropPress={this.closeWelcomeModal}
					onSwipeComplete={this.closeWelcomeModal}
					swipeDirection={'down'}
					style={styles.bottomModal}
				>
					<PaymentChannelWelcome close={this.closeWelcomeModal} />
				</Modal>
				<Modal
					isVisible={this.state.qrModalVisible}
					onBackdropPress={this.closeQrModal}
					onBackButtonPress={this.closeQrModal}
					onSwipeComplete={this.closeQrModal}
					swipeDirection={'down'}
					propagateSwipe
				>
					<View style={styles.detailsWrapper}>
						<View style={styles.qrCode}>
							<View style={styles.titleQr}>
								<Text style={styles.addressTitle}>
									{strings('receive_request.public_address_qr_code')}
								</Text>
								<TouchableOpacity style={styles.closeIcon} onPress={this.closeQrModal}>
									<IonicIcon name={'ios-close'} size={28} color={colors.black} />
								</TouchableOpacity>
							</View>
							<View style={styles.qrCodeWrapper}>
								<QRCode
									value={`ethereum:${this.props.selectedAddress}`}
									size={Dimensions.get('window').width - 160}
								/>
							</View>
							<TouchableOpacity style={styles.addressWrapper} onPress={this.copyAccountToClipboard}>
								<Text style={styles.address}>{this.props.selectedAddress}</Text>
							</TouchableOpacity>
						</View>
						<GlobalAlert />
					</View>
				</Modal>
			</SafeAreaView>
		);
	}
}

const mapStateToProps = state => ({
	selectedAddress: state.engine.backgroundState.PreferencesController.selectedAddress,
	nativeCurrency: state.engine.backgroundState.CurrencyRateController.nativeCurrency,
	currentCurrency: state.engine.backgroundState.CurrencyRateController.currentCurrency,
	contractExchangeRates: state.engine.backgroundState.TokenRatesController.contractExchangeRates,
	conversionRate: state.engine.backgroundState.CurrencyRateController.conversionRate,
	transactions: state.engine.backgroundState.TransactionController.transactions,
	internalTransactions: state.engine.backgroundState.TransactionController.internalTransactions,
	provider: state.engine.backgroundState.NetworkController.provider,
	paymentChannelsEnabled: state.settings.paymentChannelsEnabled
});

const mapDispatchToProps = dispatch => ({
	setPaymentChannelTransaction: asset => dispatch(setPaymentChannelTransaction(asset)),
	showAlert: config => dispatch(showAlert(config))
});

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(withNavigationFocus(PaymentChannel));
