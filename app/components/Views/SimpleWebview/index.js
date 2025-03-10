import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { View, Platform } from 'react-native';
import Web3Webview from 'react-native-web3-webview';
import { getWebviewNavbar } from '../../UI/Navbar';
import Share from 'react-native-share'; // eslint-disable-line  import/default
import Logger from '../../../util/Logger';
import AndroidBackHandler from '../AndroidBackHandler';
import { baseStyles } from '../../../styles/common';

export default class SimpleWebview extends PureComponent {
	static navigationOptions = ({ navigation }) => getWebviewNavbar(navigation);

	static propTypes = {
		/**
		 * react-navigation object used to switch between screens
		 */
		navigation: PropTypes.object
	};

	componentDidMount = () => {
		const { navigation } = this.props;
		navigation && navigation.setParams({ dispatch: this.share });
	};

	share = () => {
		const { navigation } = this.props;
		const url = navigation && navigation.getParam('url', null);
		if (url) {
			Share.open({
				url
			}).catch(err => {
				Logger.log('Error while trying to share simple web view', err);
			});
		}
	};

	render() {
		const uri = this.props.navigation.getParam('url', null);
		if (uri) {
			return (
				<View style={baseStyles.flexGrow}>
					<Web3Webview source={{ uri }} />
					{Platform.OS === 'android' && <AndroidBackHandler customBackPress={this.props.navigation.pop} />}
				</View>
			);
		}
	}
}
