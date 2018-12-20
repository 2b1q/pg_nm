/*
 * Azure API
 * - list VMs
 * */
// require libs from Azure SDK
const ComputeManagementClient = require("azure-arm-compute"),
    msRestAzure = require("ms-rest-azure"),
    NetworkManagementClient = require("azure-arm-network");

// setup configs
// {
//     "appId": "bc43be97-ae90-4514-ba8b-ac02d5660074",
//     "password": "afe76ad8-87ab-4e80-a791-1b4610185e55",
//     "tenant": "51ecdb43-886a-49c6-b428-2ac2f11a7560"
// }
const subscriptionId = process.env["AZURE_SUBSCRIPTION_ID"] || "2b3c918b-23fc-465a-9908-98a6c046a255",
    clientId = process.env["CLIENT_ID"] || "bc43be97-ae90-4514-ba8b-ac02d5660074",
    domain = process.env["DOMAIN"] || "51ecdb43-886a-49c6-b428-2ac2f11a7560",
    secret = process.env["APPLICATION_SECRET"] || "afe76ad8-87ab-4e80-a791-1b4610185e55",
    resourceGroupName = "blockchain-nodes-service",
    vmName = "";

msRestAzure.loginWithServicePrincipalSecret(clientId, secret, domain, function(err, credentials, subscriptions) {
    if (err) return console.log(err);
    let computeClient = new ComputeManagementClient(credentials, subscriptionId);
    let networkClient = new NetworkManagementClient(credentials, subscriptionId);

    // Get Information about the vm created in Task1.//
    // computeClient.virtualMachines.get(resourceGroupName, vmName, (err, result) => {});
    // List All the VMs under the subscription
    // computeClient.virtualMachines.listAll((err, result) => {
    //     if (err) return console.error("Error on computeClient.virtualMachines:\n", err);
    //     // console.log("========== List VM`s ==========", result);
    //     console.log("========== List VM`s ==========");
    //     result.forEach(vm => {
    //         console.log(`VM name: ${vm.name}`);
    //         let { networkProfile, osProfile } = vm;
    //         let { linuxConfiguration, computerName } = osProfile;
    //         console.log(`VM computerName: ${computerName}`);
    //         // console.log(`VM networkInterfaces:`);
    //         // console.log(`VM linuxConfiguration: `, linuxConfiguration);
    //
    //         // networkProfile.networkInterfaces.forEach(_if => {
    //         //     console.log(`networkIf: `, _if);
    //         //     networkClient.networkInterfaces.get(resourceGroupName, _if.id, (err, res) => {
    //         //         if (err) return console.error('Error on "networkClient.networkInterfaces.get"', err);
    //         //         console.log("NETWORK IF: ", res);
    //         //     });
    //         // });
    //     });
    //
    //
    // });

    const subnetType = ({ id }) => id.split("/").pop();
    networkClient.networkInterfaces.list(resourceGroupName, (err, result) => {
        if (err) return console.error('Error on "networkClient.networkInterfaces.list()",\n', err);
        console.log("=========== List network interfaces ===========\n");
        result.forEach(vm => {
            let { name, ipConfigurations, macAddress } = vm;
            console.log(`VM name: ${name}`);
            console.log(`VM macAddress: ${macAddress}`);
            console.log("VM ipConfigurations:");
            ipConfigurations.forEach(ipcfg => {
                let { privateIPAddress, privateIPAllocationMethod, name, subnet } = ipcfg;
                console.log("> privateIPAddress: ", privateIPAddress);
                console.log("> privateIPAllocationMethod: ", privateIPAllocationMethod);
                console.log("> name: ", name);
                console.log("> subnet: ", subnetType(subnet));
            });
        });
    });

    // Power off the VM
    // computeClient.virtualMachines.powerOff(resourceGroupName, vmName, function(err, result) {});
    // Start the VM
    // computeClient.virtualMachines.start(resourceGroupName, vmName, function(err, result) {});
});
