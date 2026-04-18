import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { CreateInspectionScreen } from '../screens/CreateInspectionScreen';
import { InspectionDetailScreen } from '../screens/InspectionDetailScreen';
import { InspectionListScreen } from '../screens/InspectionListScreen';
import { LoginScreen } from '../screens/LoginScreen';

export type RootStackParamList = {
  Login: undefined;
  InspectionList: undefined;
  CreateInspection: undefined;
  InspectionDetail: { inspectionId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { token } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!token ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Worker Login' }}
          />
        ) : (
          <>
            <Stack.Screen
              name="InspectionList"
              component={InspectionListScreen}
              options={{ title: 'Inspections' }}
            />
            <Stack.Screen
              name="CreateInspection"
              component={CreateInspectionScreen}
              options={{ title: 'New Inspection' }}
            />
            <Stack.Screen
              name="InspectionDetail"
              component={InspectionDetailScreen}
              options={{ title: 'Inspection Detail' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
