# Wzrdry

Wzrdry (spoken wizardry) is an API that helps with all your automations your other tools
may or may not be capable of. The focus of this project is providing an easy to use platform
while being secure and friendly for custom user extensions.

# General Design Principle

The whole projects orients itself towards extensibility and interoperability of all the
different modules. Therefor a few items are always delegated to the subservices themself.
This includes for example permissions, where every service manages their own permissions
while the platform itself only tells about higher level admin privileges. I.e. super admins
or administering users.
