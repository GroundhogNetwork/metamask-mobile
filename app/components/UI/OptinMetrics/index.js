import React, { PureComponent } from 'react';
import { View, SafeAreaView, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import PropTypes from 'prop-types';
import { baseStyles, fontStyles, colors } from '../../../styles/common';
import AsyncStorage from '@react-native-community/async-storage';
import Entypo from 'react-native-vector-icons/Entypo';
import { getOptinMetricsNavbarOptions } from '../Navbar';
import { strings } from '../../../../locales/i18n';
import setOnboardingWizardStep from '../../../actions/wizard';
import { connect } from 'react-redux';
import { NavigationActions } from 'react-navigation';
import StyledButton from '../StyledButton';
import Analytics from '../../../core/Analytics';
import ANALYTICS_EVENT_OPTS from '../../../util/analytics';
import AndroidBackHandler from '../../Views/AndroidBackHandler';

const styles = StyleSheet.create({
	root: {
		...baseStyles.flexGrow
	},
	checkIcon: {
		color: colors.green500
	},
	crossIcon: {
		color: colors.red
	},
	icon: {
		marginRight: 5
	},
	action: {
		flex: 0,
		flexDirection: 'row',
		paddingVertical: 10,
		alignItems: 'center'
	},
	title: {
		...fontStyles.bold,
		color: colors.black,
		fontSize: 22
	},
	description: {
		...fontStyles.normal,
		color: colors.black,
		flex: 1
	},
	content: {
		...fontStyles.normal,
		fontSize: 14,
		color: colors.black,
		paddingVertical: 10
	},
	wrapper: {
		marginHorizontal: 20
	},
	privacyPolicy: {
		...fontStyles.normal,
		fontSize: 14,
		color: colors.grey400,
		marginTop: 10
	},
	link: {
		textDecorationLine: 'underline'
	},
	actionContainer: {
		marginTop: 10,
		flex: 0,
		flexDirection: 'row',
		padding: 16,
		bottom: 0
	},
	button: {
		flex: 1
	},
	cancel: {
		marginRight: 8
	},
	confirm: {
		marginLeft: 8
	}
});

const PRIVACY_POLICY = 'https://metamask.io/privacy.html';
/**
 * View that is displayed in the flow to agree to metrics
 */
class OptinMetrics extends PureComponent {
	static navigationOptions = () => getOptinMetricsNavbarOptions();

	static propTypes = {
		/**
		/* navigation object required to push and pop other views
		*/
		navigation: PropTypes.object,
		/**
		 * Action to set onboarding wizard step
		 */
		setOnboardingWizardStep: PropTypes.func
	};

	actionsList = [
		{
			action: 0,
			description: strings('privacy_policy.action_description_1')
		},
		{
			action: 0,
			description: strings('privacy_policy.action_description_2')
		},
		{
			action: 0,
			description: strings('privacy_policy.action_description_3')
		},
		{
			action: 1,
			description: strings('privacy_policy.action_description_4')
		},
		{
			action: 1,
			description: strings('privacy_policy.action_description_5')
		},
		{
			action: 1,
			description: strings('privacy_policy.action_description_6')
		}
	];

	/**
	 * Action to be triggered when pressing any button
	 */
	continue = async () => {
		// Get onboarding wizard state
		const onboardingWizard = await AsyncStorage.getItem('@MetaMask:onboardingWizard');
		if (onboardingWizard) {
			this.props.navigation.navigate('HomeNav');
		} else {
			this.props.setOnboardingWizardStep(1);
			this.props.navigation.navigate('HomeNav', {}, NavigationActions.navigate({ routeName: 'WalletView' }));
		}
	};

	/**
	 * Render each action with corresponding icon
	 *
	 * @param {object} - Object containing action and description to be rendered
	 * @param {number} i - Index key
	 */
	renderAction = ({ action, description }, i) => (
		<View style={styles.action} key={i}>
			{action === 0 ? (
				<Entypo name="check" size={20} style={[styles.icon, styles.checkIcon]} />
			) : (
				<Entypo name="cross" size={24} style={[styles.icon, styles.crossIcon]} />
			)}
			<Text style={styles.description}>{description}</Text>
		</View>
	);

	/**
	 * Callback on press cancel
	 */
	onCancel = async () => {
		await AsyncStorage.setItem('@MetaMask:metricsOptIn', 'denied');
		Analytics.disable();
		Analytics.trackEvent(ANALYTICS_EVENT_OPTS.ONBOARDING_METRICS_OPT_OUT);
		this.continue();
	};

	/**
	 * Callback on press confirm
	 */
	onConfirm = async () => {
		await AsyncStorage.setItem('@MetaMask:metricsOptIn', 'agreed');
		Analytics.enable();
		Analytics.trackEvent(ANALYTICS_EVENT_OPTS.ONBOARDING_METRICS_OPT_IN);
		this.continue();
	};

	/**
	 * Callback on press policy
	 */
	onPressPolicy = () => {
		const { navigation } = this.props;
		navigation.navigate('Webview', {
			url: PRIVACY_POLICY,
			title: strings('privacy_policy.title')
		});
	};

	/**
	 * Render privacy policy description
	 *
	 * @returns - Touchable opacity object to render with privacy policy information
	 */
	renderPrivacyPolicy = () => (
		<TouchableOpacity onPress={this.onPressPolicy}>
			<Text style={styles.privacyPolicy}>
				{strings('privacy_policy.description') + ' '}
				<Text style={styles.link}>{strings('privacy_policy.here')}</Text>
				{strings('unit.point')}
			</Text>
		</TouchableOpacity>
	);

	render() {
		return (
			<SafeAreaView style={styles.root}>
				<ScrollView style={styles.root}>
					<View style={styles.wrapper}>
						<Text style={styles.title}>{strings('privacy_policy.description_title')}</Text>
						<Text style={styles.content}>{strings('privacy_policy.description_content_1')}</Text>
						<Text style={styles.content}>{strings('privacy_policy.description_content_2')}</Text>
						{this.actionsList.map((action, i) => this.renderAction(action, i))}
						{this.renderPrivacyPolicy()}
					</View>

					<View style={styles.actionContainer}>
						<StyledButton
							containerStyle={[styles.button, styles.cancel]}
							type={'cancel'}
							onPress={this.onCancel}
						>
							{strings('privacy_policy.decline')}
						</StyledButton>
						<StyledButton
							containerStyle={[styles.button, styles.confirm]}
							type={'confirm'}
							onPress={this.onConfirm}
						>
							{strings('privacy_policy.agree')}
						</StyledButton>
					</View>
				</ScrollView>
				{Platform.OS === 'android' && <AndroidBackHandler customBackPress={this.onCancel} />}
			</SafeAreaView>
		);
	}
}

const mapDispatchToProps = dispatch => ({
	setOnboardingWizardStep: step => dispatch(setOnboardingWizardStep(step))
});

export default connect(
	null,
	mapDispatchToProps
)(OptinMetrics);
