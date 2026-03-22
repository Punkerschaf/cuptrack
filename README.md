# CupTrack
CupTrack is a digital coffee fund for shared coffee machines, such as those in the office.
It simply tracks which user has drunk how many coffees and deducts the corresponding amounts from their account. CupTrack does not control the coffee machines. The system relies on honesty – just like a haptic coffee fund.
It is web based with a terminal view and an admin's dashboard.

## How it works
Drinking users have account balance and a four digit PIN.
On a machines terminal user select their user, enter their PIN and count a coffee. The predefined amount is deducted from their balance.
They also can top up their balance.

> [!TIP]
> This README and the apps documentation is still under construction. Feel free to send me a message, if have questions.

## Development
The root user on the local dev-server is `root` with password `Coffee`. Change this as well as JWT secret in the .env-file of backend before deploying to production.
There is a file `architecture.md` for AI coding agents to understand the architecture of the project without needing to read the entire codebase.

> [!NOTE]
> This application is vibe coded in most parts. Documenation may be chaos. Structure may doesn't make any sense.
