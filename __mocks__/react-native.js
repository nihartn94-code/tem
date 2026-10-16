const React = require('react');

const View = ({ children, ...props }) => React.createElement('View', props, children);
const Text = ({ children, ...props }) => React.createElement('Text', props, children);
const TouchableOpacity = ({ children, onPress, ...props }) => 
  React.createElement('TouchableOpacity', { ...props, onPress }, children);
const ScrollView = ({ children, ...props }) => React.createElement('ScrollView', props, children);
const FlatList = ({ children, ...props }) => React.createElement('FlatList', props, children);
const TextInput = React.forwardRef((props, ref) => React.createElement('TextInput', { ...props, ref }));
const ActivityIndicator = (props) => React.createElement('ActivityIndicator', props);
const StyleSheet = {
  create: (styles) => styles,
};
const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios,
};
const Alert = {
  alert: jest.fn(),
};
const Linking = {
  openURL: jest.fn(() => Promise.resolve()),
};
const Dimensions = {
  get: jest.fn(() => ({ width: 375, height: 812 })),
};

module.exports = {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  Linking,
  Dimensions,
};
