import { Switch, Route } from "wouter";
import Ask from "./pages/Ask/Page";
import NotesLanding from "./pages/Notes/Page";
import CreateNote from "./pages/CreateNote/Page";
import NoteLanding from "./pages/Note/Page";

const Router = () => {
  return (
    <Switch>
      <Route path="/" component={Ask} />
      <Route path="/notes/:id" component={NoteLanding} />
      <Route path="/notes/create" component={CreateNote} />
      <Route path="/notes" component={NotesLanding} />
    </Switch>
  );
};

export default Router;
