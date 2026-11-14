import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";

import { CurrentUser } from "#src/current-user.context.js";
import { UserId } from "#src/user.id.js";
import { CheckIn } from "#src/visits/check-in/check-in.command.js";
import { CheckedIn } from "#src/visits/check-in/checked-in.event.js";
import { NotYouError } from "#src/visits/check-in/not-you.rejection.js";
import { Visits } from "#src/visits/visits.aggregate.js";
import { VisitsModel } from "#src/visits.model.js";

const story = Story.make(VisitsModel);

type Case = () => ReturnType<typeof story>;

const { then: recorded } = Story;

const sam = UserId.make("u-sam");

const samsVisits = Visits.ref(sam);

const signedInAsSam = Story.provide(CurrentUser, { name: "Sam", userId: sam });

const countsAVisit: Case = () =>
  story(
    Story.given(samsVisits, CheckedIn.make({ name: "Sam" })),
    signedInAsSam,
    Story.when(samsVisits, CheckIn.make({})),
    recorded(samsVisits, CheckedIn.make({ name: "Sam" })),
    Story.replied({ name: "Sam", visits: 2 }),
  );

const refusesSomeoneElse: Case = () =>
  story(
    Story.provide(CurrentUser, { name: "Alex", userId: UserId.make("u-alex") }),
    Story.when(samsVisits, CheckIn.make({})),
    Story.rejected(NotYouError.make()),
  );

describe("checking in", () => {
  it.effect("records a visit under the signed-in user's name and replies with the count", countsAVisit);
  it.effect("is refused with NotYou when the signed-in user names someone else", refusesSomeoneElse);
});
