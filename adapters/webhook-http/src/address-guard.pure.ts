import { Array as Arr, Cause, Effect, Exit, Option, Result, String as Str } from "effect";
import { IpNetwork, NetAddress } from "effect/net";

import type { buildConnector } from "@effect/platform-node/Undici";

import type { Network } from "#src/network.service.js";

// Ranges that are neither private nor loopback by NetAddress's own tests but still lead inside a network: the shared
// Address space carriers and clouds use, and the IPv4 broadcast address.
const internalRanges = Arr.map(["100.64.0.0/10", "255.255.255.255/32"], IpNetwork.fromStringUnsafe);

const isInternalIpv4 = (address: NetAddress.Ipv4Address): boolean =>
  NetAddress.isLoopback(address) ||
  NetAddress.isUnspecified(address) ||
  NetAddress.isPrivate(address) ||
  NetAddress.isLinkLocal(address) ||
  NetAddress.isMulticast(address) ||
  Arr.some(internalRanges, IpNetwork.contains(address));

const isInternalIpv6 = (address: NetAddress.Ipv6Address): boolean =>
  NetAddress.isLoopback(address) ||
  NetAddress.isUnspecified(address) ||
  NetAddress.isLinkLocal(address) ||
  NetAddress.isUniqueLocal(address) ||
  NetAddress.isMulticast(address) ||
  Option.exists(NetAddress.fromIpv4Mapped(address), isInternalIpv4);

const isInternal = (address: NetAddress.IpAddress): boolean => {
  if (NetAddress.isIpv4Address(address)) {
    return isInternalIpv4(address);
  }

  return isInternalIpv6(address);
};

// Whether a webhook may be sent to the IP address: never to loopback, unspecified, private, link-local, unique local,
// Shared or multicast addresses, an IPv4 one written as IPv6 included, and never to text that is not an IP address.
const isPublicAddress = (address: string): boolean =>
  Result.match(NetAddress.ipFromString(address), { onFailure: () => false, onSuccess: (ip) => !isInternal(ip) });

// The address a request may connect to: the host itself when it is an IP address, or the first address a name
// Resolves to when every address it resolves to is public, so a name that also leads inside the network is refused.
const publicAddressOf = (network: Network["Service"], hostname: string): Effect.Effect<string, string> => {
  const host = Str.replaceAll(/^\[|\]$/gu, "")(hostname);

  const addresses = Result.match(NetAddress.ipFromString(host), {
    onFailure: () => network.lookup(host),
    onSuccess: () => Effect.succeed([host]),
  });

  return Effect.flatMap(addresses, (found) =>
    Option.match(Arr.head(found), {
      onNone: () => Effect.fail(`${hostname} resolves to no address.`),
      onSome: (first) => {
        if (Arr.every(found, isPublicAddress)) {
          return Effect.succeed(first);
        }

        return Effect.fail(`${hostname} leads to an address a webhook may not reach.`);
      },
    }),
  );
};

// Undici's callback takes an error with null in place of the socket; Option.getOrNull supplies that null.
const noSocket = Option.getOrNull(Option.none());

// Every connection undici opens goes through this check, after the lookup and right before the dial, so a name that
// Changes what it resolves to between a check and the connection still cannot reach an internal address. Undici's
// Connector reports through a callback, so the check runs as its own fiber and answers it.
const guardedConnector =
  (network: Network["Service"]): buildConnector.connector =>
  (options, connected) => {
    Effect.runCallback(publicAddressOf(network, options.hostname), {
      onExit: (exit) => {
        if (Exit.isSuccess(exit)) {
          network.dial({ ...options, hostname: exit.value }, connected);

          return;
        }

        connected(new Error(Cause.pretty(exit.cause)), noSocket);
      },
    });
  };

export { guardedConnector };
