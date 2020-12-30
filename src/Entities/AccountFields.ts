//   Copyright 2020 Vircadia Contributors
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.
'use strict'

import { Entity } from '@Entities/Entity';
import { AccountEntity } from '@Entities/AccountEntity';
import { Accounts } from '@Entities/Accounts';

import { Roles } from '@Entities/Sets/Roles';
import { Availability } from '@Entities/Sets/Availability';

import { isStringValidator, isBooleanValidator, isPathValidator, isNumberValidator } from '@Route-Tools/Validators';
import { isObjectValidator, isSArraySet, isDateValidator } from '@Route-Tools/Validators';
import { simpleGetter, simpleSetter, sArraySetter, dateStringGetter } from '@Route-Tools/Validators';
import { noGetter, noSetter, verifyAllSArraySetValues } from '@Route-Tools/Validators';
import { FieldDefn, ValidateResponse } from '@Route-Tools/EntityFieldDefn';

import { VKeyedCollection } from '@Tools/vTypes';
import { IsNullOrEmpty } from '@Tools/Misc';
import { Logger } from '@Tools/Logging';

export function CheckAccountFields(): void {
  // DEBUG DEBUG: for unknown reasons some field ops end up 'undefined'
  Object.keys(accountFields).forEach( fieldName => {
    const defn = accountFields[fieldName];
    if (typeof(defn.validate) !== 'function') {
      Logger.error(`CheckAccountFields: field ${defn.entity_field} validator is not a function`);
    };
    if (typeof(defn.getter) !== 'function') {
      Logger.error(`CheckAccountFields: field ${defn.entity_field} getter is not a function`);
    };
    if (typeof(defn.setter) !== 'function') {
      Logger.error(`CheckAccountFields: field ${defn.entity_field} setter is not a function`);
    };
  });
  // END DEBUG DEBUG
};

/*
// Get the value of a domain field with the fieldname.
// Checks to make sure the getter has permission to get the values.
// Returns the value. Could be 'undefined' whether the requestor doesn't have permissions or that's
//     the actual field value.
export async function getAccountField(pAuthToken: AuthToken, pAccount: AccountEntity,
                  pField: string, pRequestingAccount?: AccountEntity): Promise<any> {
  return getEntityField(accountFields, pAuthToken, pAccount, pField, pRequestingAccount);
};
// Set a domain field with the fieldname and a value.
// Checks to make sure the setter has permission to set.
// Returns 'true' if the value was set and 'false' if the value could not be set.
export async function setAccountField(pAuthToken: AuthToken,  // authorization for making this change
            pAccount: AccountEntity,            // the account being changed
            pField: string, pVal: any,          // field being changed and the new value
            pRequestingAccount?: AccountEntity, // Account associated with pAuthToken, if known
            pUpdates?: VKeyedCollection         // where to record updates made (optional)
                    ): Promise<ValidateResponse> {
  return setEntityField(accountFields, pAuthToken, pAccount, pField, pVal, pRequestingAccount, pUpdates);
};
// Generate an 'update' block for the specified field or fields.
// This is a field/value collection that can be passed to the database routines.
// Note that this directly fetches the field value rather than using 'getter' since
//     we want the actual value (whatever it is) to go into the database.
// If an existing VKeyedCollection is passed, it is added to an returned.
export function getAccountUpdateForField(pAccount: AccountEntity,
              pField: string | string[], pExisting?: VKeyedCollection): VKeyedCollection {
  return getEntityUpdateForField(accountFields, pAccount, pField, pExisting);
};
*/

// Naming and access for the fields in a AccountEntity.
// Indexed by request_field_name.
export const accountFields: { [key: string]: FieldDefn } = {
  'id': {
    entity_field: 'id',
    request_field_name: 'id',
    get_permissions: [ 'all' ],
    set_permissions: [ 'none' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'username': {
    entity_field: 'username',
    request_field_name: 'username',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: async (pField: FieldDefn, pEntity: Entity, pVal: any): Promise<ValidateResponse> => {
      let validity: ValidateResponse;
      if (typeof(pVal) === 'string') {
        if (/^[A-Za-z][A-Za-z0-9+\-_\.]*$/.test(pVal)) {
          // Make sure no other account has this username
          const otherAccount = await Accounts.getAccountWithUsername(pVal);
          if (IsNullOrEmpty(otherAccount) || otherAccount.id === (pEntity as AccountEntity).id) {
            validity = { valid: true };
          }
          else {
            validity = { valid: false, reason: 'username already exists' };
          };
        }
        else {
          validity = { valid: false, reason: 'username can contain only A-Za-z0-9+-_.' };
        };
      }
      else {
        validity = { valid: false, reason: 'username must be a simple string' };
      };
      return validity;
    },
    setter: simpleSetter,
    getter: simpleGetter
  },
  'email': {
    entity_field: 'email',
    request_field_name: 'email',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: async (pField: FieldDefn, pEntity: Entity, pVal: any): Promise<ValidateResponse> => {
      let validity: ValidateResponse;
      if (typeof(pVal) === 'string') {
        // Check email for sanity
        // Old style check which doesn't cover all the RFC complient email addresses possible
        // if (/^[A-Za-z0-9+\-_\.]+@[A-Za-z0-9-\.]+$/.test(pVal)) {
        // Much simpiler check that just makes sure there is one AT sign
        if ((pVal.match(/@/g) || []).length === 1) {
          // Make sure no other account is using this email address
          const otherAccount = await Accounts.getAccountWithEmail(pVal);
          if (IsNullOrEmpty(otherAccount) || otherAccount.id === (pEntity as AccountEntity).id) {
            validity = { valid: true };
          }
          else {
            validity = { valid: false, reason: 'email already exists for another account' };
          };
        }
        else {
          validity = { valid: false, reason: 'email address needs one AT sign' };
        };
      }
      else {
        validity = { valid: false, reason: 'email must be a simple string' };
      };
      return validity;
    },
    setter: (pField: FieldDefn, pEntity: Entity, pVal: any): any => {
      // emails are stored in lower-case
      (pEntity as AccountEntity).email = (pVal as string).toLowerCase();
    },
    getter: simpleGetter
  },
  'account_settings': {
    entity_field: 'accountSettings',
    request_field_name: 'account_settings',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'images_hero': {
    entity_field: 'imagesHero',
    request_field_name: 'images_hero',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'images_tiny': {
    entity_field: 'imagesTiny',
    request_field_name: 'images_tiny',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'images_thumbnail': {
    entity_field: 'imagesThumbnail',
    request_field_name: 'images_thumbnail',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'connected': {
    entity_field: 'locationConnected',
    request_field_name: 'connected',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isBooleanValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'path': {
    entity_field: 'locationPath',
    request_field_name: 'path',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isPathValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'place_id': {
    entity_field: 'locationPlaceId',
    request_field_name: 'place_id',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'domain_id': {
    entity_field: 'locationDomainId',
    request_field_name: 'domain_id',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'network_address': {
    entity_field: 'locationNetworkAddress',
    request_field_name: 'network_address',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'network_port': {
    entity_field: 'locationNetworkPort',
    request_field_name: 'network_port',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isNumberValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'node_id': {
    entity_field: 'locationNodeId',
    request_field_name: 'node_id',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'availability': {
    entity_field: 'availability',
    request_field_name: 'availability',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: async (pField: FieldDefn, pEntity: Entity, pVal: any): Promise<ValidateResponse> => {
      if (await verifyAllSArraySetValues(pVal, Availability.KnownAvailability)) {
        return { valid: true };
      }
      return { valid: false, reason: 'not legal availability value'};
    },
    setter: sArraySetter,
    getter: simpleGetter
  },
  'connections': {
    entity_field: 'connections',
    request_field_name: 'connections',
    get_permissions: [ 'owner', 'admin', 'friend', 'connection' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isSArraySet,
    setter: sArraySetter,
    getter: simpleGetter
  },
  'friends': {
    entity_field: 'friends',
    request_field_name: 'friends',
    get_permissions: [ 'owner', 'admin', 'friend' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isSArraySet,
    setter: sArraySetter,
    getter: simpleGetter
  },
  'locker': {
    entity_field: 'locker',
    request_field_name: 'locker',
    get_permissions: [ 'owner', 'admin' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isObjectValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'profile_detail': {
    entity_field: 'profileDetail',
    request_field_name: 'profile_detail',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isObjectValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },

  // User authentication
  'password': {
    entity_field: 'password',
    request_field_name: 'password',
    get_permissions: [ 'none' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: (pField: FieldDefn, pEntity: Entity, pVal: any): void => {
      Accounts.storePassword((pEntity as AccountEntity), pVal);
    },
    getter: noGetter,
    // An update to the password means updates to hash and salt fields.
    updater: (pField: FieldDefn, pEntity: Entity, pUpdates: VKeyedCollection): void => {
      pUpdates.passwordHash = (pEntity as AccountEntity).passwordHash;
      pUpdates.passwordSalt = (pEntity as AccountEntity).passwordSalt;
    }
  },
  'public_key': {
    entity_field: 'sessionPublicKey',
    request_field_name: 'public_key',
    get_permissions: [ 'all' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },

  // Old stuff
  'xmpp_password': {
    entity_field: 'xmppPassword',
    request_field_name: 'xmpp_password',
    get_permissions: [ 'owner' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'discourse_api_key': {
    entity_field: 'discourseApiKey',
    request_field_name: 'discourse_api_key',
    get_permissions: [ 'owner' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },
  'wallet_id': {
    entity_field: 'walletId',
    request_field_name: 'wallet_id',
    get_permissions: [ 'owner' ],
    set_permissions: [ 'owner', 'admin' ],
    validate: isStringValidator,
    setter: simpleSetter,
    getter: simpleGetter
  },

  // Admin stuff
  'roles': {
    entity_field: 'roles',
    request_field_name: 'roles',
    get_permissions: [ 'all' ],
    set_permissions: [ 'admin' ],
    validate: async (pField: FieldDefn, pEntity: Entity, pVal: any): Promise<ValidateResponse> => {
      if (await verifyAllSArraySetValues(pVal, Roles.KnownRole)) {
        return { valid: true };
      }
      return { valid: false, reason: 'not valid role name'};
    },
    setter: sArraySetter,
    getter: simpleGetter
  },
  'ip_addr_of_creator': {
    entity_field: 'IPAddrOfCreator',
    request_field_name: 'ip_addr_of_creator',
    get_permissions: [ 'all' ],
    set_permissions: [ 'none' ],
    validate: isStringValidator,
    setter: noSetter,
    getter: simpleGetter
  },
  'when_account_created': {
    entity_field: 'whenCreated',
    request_field_name: 'when_account_created',
    get_permissions: [ 'all' ],
    set_permissions: [ 'none' ],
    validate: isDateValidator,
    setter: noSetter,
    getter: dateStringGetter
  },
  'time_of_last_heartbeat': {
    entity_field: 'timeOfLastHeartbeat',
    request_field_name: 'time_of_last_heartbeat',
    get_permissions: [ 'all' ],
    set_permissions: [ 'admin' ],
    validate: isDateValidator,
    setter: noSetter,
    getter: dateStringGetter
  },
};
