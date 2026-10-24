# Offseason manual checklist

Run before a release, after `npm test`, `npm run test:regression` and a short soak (`npm run test:offseason-soak -- --seeds 2 --seasons 3`) pass. It covers what automated tests cannot judge: whether the screens explain what happened, and whether the offseason feels right.

Do the whole pass twice: in a desktop window about **1280px** wide, then at **375px** (browser device toolbar, iPhone SE). Then repeat steps 1, 3, 5 and 6 with **reduced motion** on and **keyboard only** (step 9).

Use a fresh CBL league (12 teams) with assistance **off**, so every decision is yours. Write down the save name and seed so a problem can be replayed.

## 1. Finish a season and enter the offseason

- [ ] Simulate to the end of the playoffs. Season Review opens and waits for you; nothing advances on its own.
- [ ] Begin the offseason (from Season Review, or by simulating a day on the calendar). The phase header shows Roster Decisions, the date has moved a day, and no error or spinner is left on screen.
- [ ] The offseason screens have no "advance phase" button: the calendar is the only way to move time. Check the offseason hub says so.
- [ ] The offseason checklist and timeline list the coming phases in order: Roster Decisions, Draft Preparation, Draft, Free Agency, Staff & Development, Preseason.

## 2. Development results

- [ ] Open the Development page (and the post-draft development review on the Draft page later). Every player is one year older, once, not two.
- [ ] Pick three players: one 21 or younger, one around 27, one 33 or older. The young one mostly improved, the veteran mostly declined, and no overall moved by more than 5.
- [ ] The explanation on screen (focus, facilities, injury) matches the numbers shown. A player with a development plan grew in that area.
- [ ] Retired players are gone from your roster and contracts, and appear in history.

## 3. Re-sign, let walk, illegal offer

- [ ] Offer an extension to a player in his final year. A legal offer is accepted or turned down with a reason.
- [ ] Try a salary below the league minimum and one above the maximum. Each is refused with a message that says which limit, and nothing changes.
- [ ] Let one expiring player walk. When Roster Decisions ends he is in the free-agent pool, not on your roster.
- [ ] If a young player qualifies for restricted free agency, issue a qualifying offer and check his RFA badge.
- [ ] Any pending team or player option blocks advancing, with a message naming the player.

## 4. Draft

- [ ] Draft Preparation asks you to confirm the draft class before the draft can start.
- [ ] The draft order matches the standings (worst first), or the lottery result if the lottery is on. Traded picks show their new owner.
- [ ] When you are on the clock, the draft waits for you. Make a pick: the rookie is on your roster with a two-season rookie contract, and payroll and cap space update.
- [ ] Other teams' picks run without you. The draft completes and Free Agency opens.

## 5. Free agency

- [ ] Sign a player for a legal salary: he joins your roster, and payroll, cap space and roster count update everywhere they are shown.
- [ ] Make an offer another team beats. Your offer shows as lost, with no player and no salary left behind.
- [ ] Try an offer over your cap space (not a minimum deal) and one with a full 15-man roster. Both are refused with a clear reason.
- [ ] Advance several days. The pool shrinks, the best players go first, and nobody appears on two teams.
- [ ] When the window closes, CPU teams have filled their rosters; no team is above 15.

## 6. Roster cut-down and the season gate

There is no training-camp step. Rosters are capped at 15 automatically (extra drafted players go to the Development League), and short rosters are filled with minimum contracts when Staff & Development ends.

- [ ] Before Staff & Development ends, put your roster above 15 or below 8. Note what the screens tell you: today no screen warns about roster size before the season gate (a known gap).
- [ ] In Preseason, release players until your roster is below 8, then select a date on or after opening day in the calendar. The date inspector says the season cannot begin, names your team and the limit, and simulating there changes nothing.
- [ ] Fix the roster and start the season.

## 7. Start the season: numbers agree

- [ ] Cap space, payroll, cash and roster count agree on the dashboard header, roster page, contracts page and finances page.
- [ ] Any staff you fired with a buyout appears as a staff expense in this season's finances, and the monthly cash flow adds up to the cash shown.
- [ ] The schedule exists and the first game is unplayed on opening day.

## 8. Reload mid-offseason

- [ ] Stop in the middle of Free Agency with an offer open. Reload the page and reopen the save.
- [ ] Same phase, same day, same pool, same open offer, same roster. Advance a day and confirm play continues normally.

## 9. Reduced motion and keyboard only

- [ ] With the OS reduced-motion setting on, lottery night and phase transitions do not animate heavily, and nothing important is only shown by animation.
- [ ] Using only the keyboard (Tab, Shift+Tab, Enter, Space, Esc), do steps 1, 3, 5 and 6. Focus is always visible, dialogs trap focus and close with Esc, and every primary action can be reached.

## Reporting

For any problem, note the save name, seed, phase, date, screen width and the exact message shown, and attach a screenshot. If it is a rules problem rather than a display one, try to reproduce it with the soak's replay command (see `docs/testing.md`).
