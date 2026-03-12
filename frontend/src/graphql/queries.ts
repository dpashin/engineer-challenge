import { gql } from '@apollo/client/core';

export const REGISTER = gql`
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password) {
      success
      userId
      email
      error {
        code
        message
      }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      success
      expiresIn
      error {
        code
        message
      }
    }
  }
`;

export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email) {
      success
      error {
        code
        message
      }
    }
  }
`;

export const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword) {
      success
      error {
        code
        message
      }
    }
  }
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      success
      expiresIn
      error {
        code
        message
      }
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout($refreshToken: String, $userId: String) {
    logout(refreshToken: $refreshToken, userId: $userId) {
      success
      revokedCount
    }
  }
`;

export const GET_USER = gql`
  query GetUser($userId: String!) {
    getUser(userId: $userId) {
      found
      user {
        id
        email
        isActive
        createdAt
      }
    }
  }
`;
