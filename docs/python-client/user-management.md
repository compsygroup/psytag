---
layout:
  width: default
  title:
    visible: false
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
  metadata:
    visible: false
  tags:
    visible: true
  actions:
    visible: true
---

# User Management

<h2 align="center">User Management</h2>

The User Management module allows to programmatically list, inspect, create, update, and remove Psytag user accounts.

### Inspecting Your Own Account

You can verify your current authenticated user session and view your user details using `UM.my_info()` or `get_my_info()`.

```python
import json
from psytag.managers import UM, get_my_info

# Retrieve your current account details
me = UM.my_info()
# me = get_my_info() # Standalone alternative

print(json.dumps(me, indent=4))
```

### Listing and Reading Users

To view all accounts registered in Psytag, use `list_users()`. This function returns a list of `User` objects. You can access individual user fields as object attributes. To fetch a specific user by their unique database ID, use `read_user()`:

```python
from psytag.managers import UM, list_users, read_user

# List all users in the system
all_users = UM.list()
# all_users = list_users()

for user in all_users:
    print(user.id, user.username, user.fullname, user.email, user.admin, user.manager)

# Read a specific user by ID
if all_users:
    target_id = all_users[0].id
    specific_user = UM.read(target_id)
    # specific_user = read_user(target_id)
    print(f"Loaded user: {specific_user.username} ({specific_user.fullname})")
```

### Creating a New User

To create a new account, supply a dictionary of user attributes to `create_user()` or `UM.create()`. The `username` field must be unique.

#### API Access & Keys

If you set `API_access` to `True`, Psytag will automatically generate an API key for the new account and return it in the creation response. Save this key immediately and share it securely with the user; it is hashed on the server and will not be displayed again.

```python
from psytag.managers import UM, create_user

user_info = {
    "username": "frederick",         # Must be unique
    "fullname": "Frederick Douglass",
    "email": "frederick@example.com",
    "admin": False,                  # Grant system admin privileges
    "manager": True,                 # Grant project manager privileges
    "API_access": True,              # Generates an API key upon creation
    "password_access": False         # Used for local authentication setups
}

# Create the user account
new_user = UM.create(user_info)
# new_user = create_user(user_info)
```

### Updating User Accounts

To update existing user details, pass the user ID and a dictionary containing the updated attributes to `update_user()` or `UM.update()`. If you update a user's `API_access` from `False` to `True`, Psytag will generate and print a new API key in the response output.

```python
from psytag.managers import UM, update_user

# Update user email and full name
UM.update(new_user.id, {
    "fullname": "Frederick Douglass Jr.",
    "email": "frederick.jr@example.com"
})
# update_user(new_user.id, {"email": "frederick.jr@example.com"})
```

{% hint style="info" %}
If the user forgets their API key, you can first set their `API_access` to `False` and then `True` again. This will generate and display a new key. The same trick can be used for passwords as well.&#x20;
{% endhint %}

### Deleting Users

To permanently delete a user account from Psytag, pass their user ID to `delete_user()` or `UM.delete()`. Deleting a user also automatically removes them from any project user lists or project manager lists they were assigned to.

```python
from psytag.managers import UM, delete_user

# Delete the user account
UM.delete(new_user.id)
# delete_user(new_user.id)
```

{% hint style="danger" %}
Please use the delete function with caution. Deleting users is irreversible, and Psytag will not prompt you for confirmation before proceeding.&#x20;
{% endhint %}
