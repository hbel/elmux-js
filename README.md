# elmux-js
ELM-inspired, minimalistic global state handler for React applications, using the functional programming power of [sum-type](https://github.com/JAForbes/sum-type) 
and [sanctuary-js](https://github.com/sanctuary-js/sanctuary).

# Design premises

1. Commands are strictly typed and organized in sum types, and can be defined on the component level.
2. Executing a command describes how global state should change, but will not perform it themselves.
3. State changes are performed by the library itself.
4. Existing React concepts (Context, Props, State) are used without introducing additional data structures.

# Basics

If your're familiar with ELM, you'll find yourself right at home with the nomenclature used here. If not, you can easily transfer 
the concepts over to more Flux-like concepts using the following table:

|Flux |elmux-js|
|-----|--------|
|State|Model   |
|Action|Command|
|Reducer|update|
|Dispatcher|(dispatching is done automatically by the library)|

All state changes are described by *Commands*. The first thing to do is to define an object for our data model and a type including 
all the commands we wish to use. We do this by definining a new *union type* for our commands:

``` javascript
import $ from 'sanctuary-def';
import Setup from 'sum-type';

const checkTypes = true;
const Type = Setup($, { checkTypes: checkTypes, env });

/** Union type describing all possible commands and their parameters */
const Commands = Type.Anonymous({
  Inc: [$.Number],
  Dec: [$.Number],
})

const initModel = { count: 0 }
```
In this basic example, two commands *Inc* and *Dec* are defined which both include an amount which determines by what amount 
we would like to change our counter. Both commands are runtime-typechecked, so Commands not containing a number parameter will 
be rejected.

Now we define an *update* function which will be used to execute code based on the commands we received:
``` javascript
const update = (model, cmd) => cmd.case({
  Inc: n => ({ count: model.count + n }),
  Dec: n => ({ count: model.count - n }),
});
```
The update function receives the current model and the command to process, and uses pattern matching to extract the command and it's 
parameters. It will return an object containing all changes to the model to be performed (similar to what you're used to when dealing 
with the *setState* function of a React component).

The final step is to combine your model, Commands, and update with your React parent component you've chosen to hold the state for your 
app. The library provides a *createCommandHandler* for doing just that. Afterwards, simply dispatch Commands using the *send* function
generated for you to manipulate the state of your app:

``` javascript
class App extends React.Component {
  state = createCommandHandler(this, update, initState);
  
  increase = () => this.state.send(Commands.Inc(1));
  decrease = () => this.state.send(Commands.Dec(1));
  
  render = () =>
      <div className="App">
        <div>
            Count {this.state.count}  &nbsp;
        <button onClick={this.increase}>Add One</button>
            &nbsp;
        <button onClick={this.decrease}>Subtract One</button>
      </div>
}
``` 
# Asynchronous calls

You can easily use asynchronous calls inside of your *update*-functions. Don't return any model change here (just return {} or nothing), but make your async call and send out another Command ín your callback which will actually deploy the changes to the model; the model parameter of update includes the same *send* function you also use inside of your component:

``` javascript
...
ShowMessage: (m, f) => ({ message: { msg: m, from: f } }),
SendRequest: url => {
  axios.get(url)
    .then(response => model.send(Commands.ShowMessage(response.data, url)))
    .catch(() => model.send(Commands.ShowMessage("An error occured", "HTTP")));
  return {};
},
...
```

# Making the global state available in child components

Use the usual methods for sending down data to child components:
1. Send your data store as a prop to the child:
``` javascript
render = () =>
    <div className="App">
      <Child store={this.state} />
    </div>
'''
```
2. Use a Context to provide children with your global data store. The library already exports a *CommandContext* you can use for that:
``` javascript
render = () =>
    <CommandContext.Provider value={this.state}>
      <div className="App">
        <Child />
      </div>
    </CommandContext.Provider>
'''
```
In the child, either access the context directly (suitable if you don't want to use the *send* function there):
``` javascript
render = () =>
  <CommandContext.Consumer>
        {store => <div>
            Count {store.count} &nbsp;
          </div>
        }
  </CommandContext.Consumer>;
```    
or use the libraries HOC wrapper to transfer the data store into the child's props:
``` javascript
const Main = () => withStore(MainImpl);

class MainImpl extends React.Component {
    send = this.props.store.send;

    increase = () => this.send(Commands.Inc(1));
    decrease = () => this.send(Commands.Dec(1));

    render = () => (
        <div>
            Count {this.props.store.count}  &nbsp;
        <button onClick={this.increase}>Add One</button>
            &nbsp;
        <button onClick={this.decrease}>Subtract One</button>
        </div>
    );
}
```
# Decoupling child components

In more complex applications, it is advisable to provide components with their own model definition and update function:

``` javascript
export const SubCommand = Type.Anonymous({
    From: [String],
    Says: [String],
})

export const update = (state, cmd) => cmd.case({
    From: s => ({ from: S.Just(s) }),
    Says: s => ({ msg: S.Just(s) }),
});
```

You can now use props on the child component to provide it with a customized send function and sub-object of the global state. 

Just add the appropiate props in your main component:
``` javascript
<Messenger send={(cmd) => this.state.send(Commands.Show(cmd))} data={this.state.message} />
```
provide a global command which accepts the SubCommand as a parameter in your global update function (the library provides a
*model.update* function to proxy Commands and a Subobject of the global state to a child update function):
``` javascript
Show: msgCmd => ({ message: model.update(msgUpdate, msgCmd, state.message) }),
```
and use them accordingly in your child component:
``` javascript
class Messenger extends React.Component {
    sender = () => this.props.send(SubCommand.From("Foo"));
    msg = () => this.props.send(SubCommand.Says("Bar"));

    showMsg = () => S.joinWith(" says ", S.fromMaybe([],
        S.sequence(S.Maybe, [this.props.data.from, this.props.data.msg])));

    render = () => (
        <div>
            <div>
                {this.props.data.from} says {this.props.data.msg}
            </div>
            <button onClick={this.sender}>Sender</button>
            &nbsp;
            <button onClick={this.msg}>Msg</button>
        </div>
    );
}
```
