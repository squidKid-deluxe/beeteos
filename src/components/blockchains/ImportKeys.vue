<script setup lang="js">
import { ref, inject, computed } from "vue";
import { ipcRenderer } from "electron";

const emitter = inject("emitter");
import { useI18n } from "vue-i18n";
const { t } = useI18n({ useScope: "global" });
import getBlockchainAPI from "../../lib/blockchains/blockchainFactory";

const props = defineProps({
  chain: {
    type: String,
    required: true,
    default: "",
  },
});

let accountname = ref("");
let privateKey = ref("");

let accessType = computed(() => {
  if (!props.chain) {
    return null;
  }
  let blockchain = getBlockchainAPI(props.chain);
  return blockchain.getAccessType();
});

let requiredFields = computed(() => {
  if (!props.chain) {
    return null;
  }
  let blockchain = getBlockchainAPI(props.chain);
  return blockchain.getSignUpInput();
});

function back() {
  emitter.emit("back", true);
}

async function next() {
  let blockchain = await getBlockchainAPI(props.chain);

  let authorities = {};
  if (requiredFields.value.privateKey != null) {
    authorities.privateKey = privateKey.value;
  }

  let account;
  try {
    account = await blockchain.verifyAccount(
      accountname.value,
      authorities.privateKey,
      props.chain
    );
  } catch (error) {
    console.log(error);
    ipcRenderer.send("notify", t("common.unverified_account_error"));
    return;
  }

  if (!account) {
    console.log("Account not found");
    return;
  }

  emitter.emit("accounts_to_import", [
    {
      account: {
        accountName: accountname.value,
        storedAccount: account,
        chain: props.chain,
        keys: authorities,
      },
    },
  ]);
}
</script>

<template>
  <div id="step2">
    <p class="mb-2 font-weight-bold">
      {{
        t(accessType == "account" ? "common.account_name" : "common.address_name", { chain: chain })
      }}
    </p>
    <input
      id="inputAccount"
      v-model="accountname"
      type="text"
      class="form-control mb-3"
      :placeholder="
        t(accessType == 'account' ? 'common.account_name' : 'common.address_name', { chain: chain })
      "
      required
    />
    <p class="my-3 font-weight-normal">
      {{ t("common.keys_cta") }}
    </p>

    <template v-if="requiredFields.privateKey !== null">
      <p class="mb-2 font-weight-bold">
        {{ t(accessType == "account" ? "common.active_authority" : "common.public_authority") }}
      </p>
      <input
        id="inputActive"
        v-model="privateKey"
        type="password"
        class="form-control mb-3 small"
        :placeholder="
          t(
            accessType == 'account'
              ? 'common.active_authority_placeholder'
              : 'common.public_authority_placeholder'
          )
        "
        required
      />
    </template>

    <ui-grid>
      <ui-grid-cell columns="12">
        <ui-button outlined class="step_btn" @click="back">
          {{ t("common.back_btn") }}
        </ui-button>

        <span v-if="requiredFields.privateKey != null">
          <ui-button
            v-if="accountname !== '' && privateKey !== ''"
            raised
            class="step_btn"
            type="submit"
            @click="next"
          >
            {{ t("common.next_btn") }}
          </ui-button>
          <ui-button v-else disabled class="step_btn" type="submit">
            {{ t("common.next_btn") }}
          </ui-button>
        </span>
        <span v-else>
          <ui-button disabled class="step_btn" type="submit">
            {{ t("common.next_btn") }}
          </ui-button>
        </span>
      </ui-grid-cell>
    </ui-grid>
  </div>
</template>
