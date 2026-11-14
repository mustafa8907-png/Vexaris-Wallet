## Default Permission

Uygulama içi dApp tarayıcısının sekme yönetimi ve sağlayıcı köprüsü.

Bu izinler yalnızca cüzdanın kendi arayüzüne (main webview) verilir; sitelerin
kendisi Tauri IPC'sine erişemez. Site istekleri Kotlin köprüsünden gelir ve
cüzdanın onay kuyruğuna düşer.

#### This default permission set includes the following:

- `allow-create`
- `allow-set-bounds`
- `allow-show`
- `allow-hide`
- `allow-set-visible`
- `allow-load-url`
- `allow-go-back`
- `allow-go-forward`
- `allow-reload`
- `allow-stop-loading`
- `allow-set-desktop-mode`
- `allow-close`
- `allow-close-all`
- `allow-respond`
- `allow-set-provider`
- `allow-clear-data`
- `allow-snapshot`
- `allow-register-listener`
- `allow-remove-listener`

## Permission Table

<table>
<tr>
<th>Identifier</th>
<th>Description</th>
</tr>


<tr>
<td>

`vexwebview:allow-clear-data`

</td>
<td>

Enables the clear_data command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-clear-data`

</td>
<td>

Denies the clear_data command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-close`

</td>
<td>

Enables the close command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-close`

</td>
<td>

Denies the close command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-close-all`

</td>
<td>

Enables the close_all command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-close-all`

</td>
<td>

Denies the close_all command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-create`

</td>
<td>

Enables the create command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-create`

</td>
<td>

Denies the create command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-go-back`

</td>
<td>

Enables the go_back command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-go-back`

</td>
<td>

Denies the go_back command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-go-forward`

</td>
<td>

Enables the go_forward command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-go-forward`

</td>
<td>

Denies the go_forward command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-hide`

</td>
<td>

Enables the hide command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-hide`

</td>
<td>

Denies the hide command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-load-url`

</td>
<td>

Enables the load_url command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-load-url`

</td>
<td>

Denies the load_url command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-register-listener`

</td>
<td>

Enables the register_listener command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-register-listener`

</td>
<td>

Denies the register_listener command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-reload`

</td>
<td>

Enables the reload command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-reload`

</td>
<td>

Denies the reload command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-remove-listener`

</td>
<td>

Enables the remove_listener command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-remove-listener`

</td>
<td>

Denies the remove_listener command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-respond`

</td>
<td>

Enables the respond command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-respond`

</td>
<td>

Denies the respond command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-set-bounds`

</td>
<td>

Enables the set_bounds command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-set-bounds`

</td>
<td>

Denies the set_bounds command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-set-desktop-mode`

</td>
<td>

Enables the set_desktop_mode command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-set-desktop-mode`

</td>
<td>

Denies the set_desktop_mode command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-set-provider`

</td>
<td>

Enables the set_provider command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-set-provider`

</td>
<td>

Denies the set_provider command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-set-visible`

</td>
<td>

Enables the set_visible command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-set-visible`

</td>
<td>

Denies the set_visible command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-show`

</td>
<td>

Enables the show command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-show`

</td>
<td>

Denies the show command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-snapshot`

</td>
<td>

Enables the snapshot command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-snapshot`

</td>
<td>

Denies the snapshot command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:allow-stop-loading`

</td>
<td>

Enables the stop_loading command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`vexwebview:deny-stop-loading`

</td>
<td>

Denies the stop_loading command without any pre-configured scope.

</td>
</tr>
</table>
