var subscriptionId = process.env["AZURE_SUBSCRIPTION_ID"];
var clientId = process.env["CLIENT_ID"];
var domain = process.env["DOMAIN"];
var secret = process.env["APPLICATION_SECRET"];
var resourceGroupName = "";
var vmName = "";

var ComputeManagementClient = require("azure-arm-compute");
var msRestAzure = require("ms-rest-azure");
msRestAzure.loginWithServicePrincipalSecret(clientId, secret, domain, function(err, credentials, subscriptions) {
    if (err) return console.log(err);
    let computeClient = new ComputeManagementClient(credentials, subscriptionId);
    // Get Information about the vm created in Task1.//
    computeClient.virtualMachines.get(resourceGroupName, vmName, (err, result) => {});
    // List All the VMs under the subscription
    computeClient.virtualMachines.listAll((err, result) => {});
    // Poweroff the VM
    computeClient.virtualMachines.powerOff(resourceGroupName, vmName, function(err, result) {});
    // Start the VM
    computeClient.virtualMachines.start(resourceGroupName, vmName, function(err, result) {});
});
