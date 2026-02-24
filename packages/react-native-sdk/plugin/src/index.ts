import { ConfigPlugin, withPlugins } from "@expo/config-plugins";

interface OpencomPluginProps {
  workspaceId: string;
  convexUrl: string;
}

const withOpencom: ConfigPlugin<OpencomPluginProps> = (config, props) => {
  if (!props?.workspaceId) {
    throw new Error("[@opencom/react-native-sdk] workspaceId is required in plugin config");
  }
  if (!props?.convexUrl) {
    throw new Error("[@opencom/react-native-sdk] convexUrl is required in plugin config");
  }

  // Store config in expo extra for runtime access
  config.extra = {
    ...config.extra,
    opencom: {
      workspaceId: props.workspaceId,
      convexUrl: props.convexUrl,
    },
  };

  return withPlugins(config, [
    // Add any native configuration plugins here
    // For now, we just store the config in extra
  ]);
};

export default withOpencom;
